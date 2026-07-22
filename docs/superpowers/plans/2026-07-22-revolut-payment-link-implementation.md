# Pre-filled Payment Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare Revolut profile link in onboarding, and the plain-text-only payment options in `/offboarding3`, with pre-filled Revolut/PayPal deep links (amount + reference note baked in), reusing one shared pure-function module.

**Architecture:** A single new pure-function module, `src/utils/paymentLink.ts`, exports `buildRevolutPaymentLink(name, amountEuros, noteLabel?)` and `buildPaypalPaymentLink(paypalUsername, amountEuros)`. Onboarding (`onboardingConversation.ts`) and offboarding (`adminCommands.ts`) both import and call these functions instead of hardcoding URLs. Three new optional env vars (`PAYMENT_AMOUNT`, `PAYPAL_ME_USERNAME`, `BANK_IBAN`) configure amounts/handles, each with safe empty/default fallbacks — no changes to `src/config/environment.ts`'s validation.

**Tech Stack:** TypeScript (ESM), grammY (`InlineKeyboard`), Jest + ts-jest (`jest.unstable_mockModule` / dynamic `await import`), Fluent (`.ftl`) i18n.

## Global Constraints

- No new required env vars — `PAYMENT_AMOUNT`, `PAYPAL_ME_USERNAME`, `BANK_IBAN` are all optional with fallbacks, matching existing `MBWAY_NUMBER` style (`src/config/environment.ts` is NOT modified).
- The note year `2026` stays a hardcoded literal (not configurable) — see spec Out of Scope.
- `buildRevolutPaymentLink` / `buildPaypalPaymentLink` are pure functions: no I/O, cannot throw.
- Follow existing codebase conventions: global `isNaN()` (not `Number.isNaN()`), arrow-function `const` exports (see `src/utils/formatters.ts`), `jest.unstable_mockModule` + dynamic import for ESM mocking.
- All new/changed behavior is implemented test-first (RED → GREEN), per project convention.
- Spec of record: `docs/superpowers/specs/2026-07-22-revolut-payment-link-design.md`.

---

## File Structure

| File | Change |
|---|---|
| `src/utils/paymentLink.ts` | **New.** `buildRevolutPaymentLink`, `buildPaypalPaymentLink`, internal `sanitizeName` helper. |
| `src/__tests__/utils/paymentLink.test.ts` | **New.** Unit tests for both exported functions. |
| `src/conversations/onboardingConversation.ts` | **Modify.** Resolve `PAYMENT_AMOUNT` (fallback 50 + warn log), build Revolut URL via `buildRevolutPaymentLink`, interpolate `amount` into payment text. |
| `src/__tests__/conversations/onboardingConversation.test.ts` | **Modify.** Add `warn` to logger mock, import mocked `InlineKeyboard`, add URL/translate assertions to the existing flow test. |
| `src/botsCommands/adminCommands.ts` | **Modify.** `/offboarding3`: add Revolut+PayPal inline buttons for users who owe money, interpolate `iban`. |
| `src/__tests__/botsCommands/adminCommands.test.ts` | **Modify.** Add `PAYPAL_ME_USERNAME`/`BANK_IBAN` env setup, assert button URLs and `iban` translate var. |
| `src/locales/en.ftl` / `src/locales/pt.ftl` | **Modify.** `onboarding-payment-instructions` amount interpolation; `offboarding-final-pay` restructure; new `offboarding-btn-pay-paypal` key. |
| `.env.example` | **Modify.** Add `PAYMENT_AMOUNT`, `PAYPAL_ME_USERNAME`, `BANK_IBAN`. |

---

## Task 1: `paymentLink.ts` utility module

**Files:**
- Create: `src/utils/paymentLink.ts`
- Test: `src/__tests__/utils/paymentLink.test.ts`

**Interfaces:**
- Produces: `buildRevolutPaymentLink(name: string, amountEuros: number, noteLabel?: string): string` (default `noteLabel = 'PDC_2026'`); `buildPaypalPaymentLink(paypalUsername: string, amountEuros: number): string`. Both are consumed by Task 2 and Task 3.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/utils/paymentLink.test.ts`:

```ts
import { describe, it, expect } from '@jest/globals';
import { buildRevolutPaymentLink, buildPaypalPaymentLink } from '../../utils/paymentLink.js';

describe('buildRevolutPaymentLink', () => {
  it('builds a URL with the sanitized plain ASCII name', () => {
    expect(buildRevolutPaymentLink('John Smith', 50)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_John_Smith',
    );
  });

  it('strips diacritics from accented names', () => {
    expect(buildRevolutPaymentLink('João Silva', 50)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_Joao_Silva',
    );
  });

  it('collapses irregular whitespace into single underscores', () => {
    expect(buildRevolutPaymentLink('  Ana   Costa ', 50)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_Ana_Costa',
    );
  });

  it('strips punctuation and collapses underscores', () => {
    expect(buildRevolutPaymentLink("Anne-Marie O'Neil", 50)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_AnneMarie_ONeil',
    );
  });

  it('falls back to "user" for an empty or whitespace-only name', () => {
    expect(buildRevolutPaymentLink('   ', 50)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_user',
    );
    expect(buildRevolutPaymentLink('', 50)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_user',
    );
  });

  it('uses a custom noteLabel when provided', () => {
    expect(buildRevolutPaymentLink('João Silva', 25.5, 'PDC_2026_Settlement')).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=2550&note=PDC_2026_Settlement_Joao_Silva',
    );
  });

  it('rounds fractional euro amounts to the nearest cent', () => {
    expect(buildRevolutPaymentLink('John Smith', 49.99)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=4999&note=PDC_2026_John_Smith',
    );
  });
});

describe('buildPaypalPaymentLink', () => {
  it('builds a PayPal.me URL with a 2-decimal amount', () => {
    expect(buildPaypalPaymentLink('azeiteiro', 25.5)).toBe('https://paypal.me/azeiteiro/25.50EUR');
  });

  it('formats a whole-euro amount with 2 decimals', () => {
    expect(buildPaypalPaymentLink('azeiteiro', 25)).toBe('https://paypal.me/azeiteiro/25.00EUR');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/utils/paymentLink.test.ts`
Expected: FAIL — `Cannot find module '../../utils/paymentLink.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/paymentLink.ts`:

```ts
const sanitizeName = (name: string): string => {
  const withoutDiacritics = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const withUnderscores = withoutDiacritics.trim().replace(/\s+/g, '_');
  const alphanumericOnly = withUnderscores.replace(/[^A-Za-z0-9_]/g, '');
  const collapsed = alphanumericOnly.replace(/_+/g, '_').replace(/^_|_$/g, '');

  return collapsed || 'user';
};

/**
 * Build a pre-filled Revolut deep link with currency, amount, and a reference note.
 */
export const buildRevolutPaymentLink = (
  name: string,
  amountEuros: number,
  noteLabel: string = 'PDC_2026',
): string => {
  const note = `${noteLabel}_${sanitizeName(name)}`;
  const cents = Math.round(amountEuros * 100);

  return `https://revolut.me/azeiteiro?currency=EUR&amount=${cents}&note=${encodeURIComponent(note)}`;
};

/**
 * Build a pre-filled PayPal.me deep link with a 2-decimal EUR amount.
 */
export const buildPaypalPaymentLink = (paypalUsername: string, amountEuros: number): string => {
  const formattedAmount = amountEuros.toFixed(2);

  return `https://paypal.me/${paypalUsername}/${formattedAmount}EUR`;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/utils/paymentLink.test.ts`
Expected: PASS — 9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/paymentLink.ts src/__tests__/utils/paymentLink.test.ts
git commit -m "feat: add paymentLink utility for pre-filled Revolut/PayPal links"
```

---

## Task 2: Onboarding wiring — pre-filled Revolut link + amount interpolation

**Files:**
- Modify: `src/conversations/onboardingConversation.ts:460-468`
- Test: `src/__tests__/conversations/onboardingConversation.test.ts`
- Modify: `src/locales/en.ftl:141`, `src/locales/pt.ftl:141`
- Modify: `.env.example` (after `MBWAY_NUMBER`)

**Interfaces:**
- Consumes: `buildRevolutPaymentLink(name: string, amountEuros: number, noteLabel?: string): string` from Task 1.

- [ ] **Step 1: Write the failing test additions**

In `src/__tests__/conversations/onboardingConversation.test.ts`, update the logger mock (around line 5-13) to add `warn`:

```ts
jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  loggers: {
    userChat: jest.fn(),
  },
}));
```

Add an import for the mocked `InlineKeyboard`, right after the existing `i18nMock` import (around line 56):

```ts
const { i18n: i18nMock } = await import('../../config/i18n.js');
const { InlineKeyboard } = await import('grammy');
```

In the `'should complete full onboarding flow with confirmation'` test (around line 299-303), extend the existing assertions:

```ts
      expect(userRepository.updateUserStatus).toHaveBeenCalledWith(mockDb, 123, 'WAITING_PAYMENT');
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('onboarding-payment-instructions'),
        expect.objectContaining({ reply_markup: expect.anything() }),
      );

      const keyboardInstance = (InlineKeyboard as jest.Mock).mock.results[0].value;
      const revolutUrl = (keyboardInstance.url as jest.Mock).mock.calls[0][1];

      expect(revolutUrl).toBe(
        'https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_John_Doe',
      );
      expect(i18nMock.translate).toHaveBeenCalledWith('en', 'onboarding-payment-instructions', {
        mbwayNumber: '',
        amount: '50',
      });
    });
```

(`data.nome` resolves to `'John Doe'` from `mockCtx.from = { first_name: 'John', last_name: 'Doe', ... }`; `PAYMENT_AMOUNT` and `MBWAY_NUMBER` are unset in this test's env, so the code falls back to `50` and `''` respectively.)

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/conversations/onboardingConversation.test.ts -t "should complete full onboarding flow with confirmation"`
Expected: FAIL — `revolutUrl` is `'https://revolut.me/azeiteiro'` (no query string), not the expected pre-filled URL.

- [ ] **Step 3: Write the minimal implementation**

In `src/conversations/onboardingConversation.ts`, add the import (near the other relative imports, around line 8):

```ts
import { deleteUser, updateUserStatus } from '../storage/userRepository.js';
import { buildRevolutPaymentLink } from '../utils/paymentLink.js';
```

Replace lines 460-468 (the `mbwayNumber`/`paymentKeyboard`/`ctx.reply` block):

```ts
    const paymentAmountEnv = process.env.PAYMENT_AMOUNT ? Number(process.env.PAYMENT_AMOUNT) : NaN;
    const paymentAmount = isNaN(paymentAmountEnv) ? 50 : paymentAmountEnv;

    if (isNaN(paymentAmountEnv)) {
      logger.warn(
        { userId, rawValue: process.env.PAYMENT_AMOUNT },
        'PAYMENT_AMOUNT invalid or unset, falling back to 50',
      );
    }

    const mbwayNumber = process.env.MBWAY_NUMBER || '';
    const paymentKeyboard = new InlineKeyboard().url(
      t('onboarding-btn-pay-revolut'),
      buildRevolutPaymentLink(data.nome, paymentAmount),
    );

    await ctx.reply(
      t('onboarding-payment-instructions', { mbwayNumber, amount: String(paymentAmount) }),
      {
        reply_markup: paymentKeyboard,
      },
    );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/conversations/onboardingConversation.test.ts`
Expected: PASS — all tests in the file passing, including the new assertions.

- [ ] **Step 5: Update FTL text to interpolate the amount**

In `src/locales/en.ftl`, change (around line 141):

```
    To join the 2026 group, we need a €50 transfer to Daniel Azeiteiro, via MBWay or Revolut.
```

to:

```
    To join the 2026 group, we need a €{$amount} transfer to Daniel Azeiteiro, via MBWay or Revolut.
```

In `src/locales/pt.ftl`, change (around line 141):

```
    Para entrares no grupo 2026, precisamos de uma transferência de €50 para o Daniel Azeiteiro, por MBWay ou Revolut.
```

to:

```
    Para entrares no grupo 2026, precisamos de uma transferência de €{$amount} para o Daniel Azeiteiro, por MBWay ou Revolut.
```

- [ ] **Step 6: Add the `PAYMENT_AMOUNT` env var to `.env.example`**

In `.env.example`, after the `MBWAY_NUMBER=+351XXXXXXXXX` line, add:

```
# Onboarding join-fee amount in whole euros (used in both the payment text and the Revolut deep link)
PAYMENT_AMOUNT=50
```

- [ ] **Step 7: Run the full test suite to confirm no regressions**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest`
Expected: PASS — all suites green.

- [ ] **Step 8: Commit**

```bash
git add src/conversations/onboardingConversation.ts src/__tests__/conversations/onboardingConversation.test.ts src/locales/en.ftl src/locales/pt.ftl .env.example
git commit -m "feat: pre-fill onboarding Revolut link with amount and note"
```

---

## Task 3: Offboarding wiring — Revolut + PayPal buttons on `/offboarding3`

**Files:**
- Modify: `src/botsCommands/adminCommands.ts:1-12,312-360`
- Test: `src/__tests__/botsCommands/adminCommands.test.ts`
- Modify: `src/locales/en.ftl:272-281`, `src/locales/pt.ftl:272-281`
- Modify: `.env.example` (after `PAYMENT_AMOUNT`)

**Interfaces:**
- Consumes: `buildRevolutPaymentLink`, `buildPaypalPaymentLink` from Task 1.

- [ ] **Step 1: Write the failing test additions**

In `src/__tests__/botsCommands/adminCommands.test.ts`, add env vars to `beforeEach` (around line 85, after `process.env.MBWAY_NUMBER = '912345678';`):

```ts
    process.env.MBWAY_NUMBER = '912345678';
    process.env.PAYPAL_ME_USERNAME = 'azeiteiro';
    process.env.BANK_IBAN = 'PT50000000000000000000000';
```

Add an `i18n` import alongside the existing dynamic imports (around line 63-64):

```ts
const { formatExpenses } = await import('../../utils/formatters.js');
const { i18n } = await import('../../config/i18n.js');
const { loggers } = await import('../../utils/logger.js');
```

Replace the `'should send final messages for positive and negative amounts'` test (around line 472-487) with:

```ts
    it('should send final messages for positive and negative amounts', async () => {
      const ctx = createCtx(adminId);

      (getOffboardingBalances as jest.Mock).mockResolvedValue(
        new Map([
          [1, 100.0],
          [2, -25.5],
        ]) as never,
      );
      (getUserById as jest.Mock).mockReturnValue({ preferred_language: 'en' } as never);

      await handlers['offboarding3'](ctx);

      expect(mockBot.api.sendMessage).toHaveBeenCalledTimes(2);
      expect(ctx.reply).toHaveBeenCalledWith('mocked translation');

      // User 1 is owed money: no payment buttons.
      const receiveOptions = mockBot.api.sendMessage.mock.calls[0][2] as {
        parse_mode: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reply_markup?: any;
      };

      expect(receiveOptions.reply_markup).toBeUndefined();

      // User 2 owes money: Revolut + PayPal buttons, pre-filled with their amount.
      const payOptions = mockBot.api.sendMessage.mock.calls[1][2] as {
        parse_mode: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reply_markup: any;
      };
      const buttons = payOptions.reply_markup.inline_keyboard[0];

      expect(buttons[0].url).toContain('PDC_2026_Settlement_');
      expect(buttons[1].url).toBe('https://paypal.me/azeiteiro/25.50EUR');

      const payTranslateCall = (i18n.translate as jest.Mock).mock.calls.find(
        (call) => call[1] === 'offboarding-final-pay',
      );

      expect(payTranslateCall?.[2]).toEqual({
        amount: '25.50',
        mbwayNumber: '912345678',
        iban: 'PT50000000000000000000000',
      });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/botsCommands/adminCommands.test.ts -t "should send final messages"`
Expected: FAIL — `payOptions.reply_markup` is `undefined` (no keyboard sent today), and `payTranslateCall` is `undefined` (no `iban` var passed today).

- [ ] **Step 3: Write the minimal implementation**

In `src/botsCommands/adminCommands.ts`, add imports (around line 3-6):

```ts
import { readFileSync } from 'fs';
import { getResourcePath } from '../utils/dataLoader.js';
import { Bot, InlineKeyboard } from 'grammy';
import type Database from 'better-sqlite3';
import type { BotContext } from '../types/types.js';
import { createAlbum, getAlbumInfo, getAlbums } from '../googleApi/googlePhotosAPI.js';
import { loggers } from '../utils/logger.js';
import { getSheetData, getOffboardingBalances } from '../googleApi/googleSheetsApi.js';
import { formatExpenses } from '../utils/formatters.js';
import { generateDailyMessage } from '../utils/utils.js';
import { getAllCompletedUsers, getAllUsers, getUserById } from '../storage/userRepository.js';
import { i18n } from '../config/i18n.js';
import { buildRevolutPaymentLink, buildPaypalPaymentLink } from '../utils/paymentLink.js';
```

Replace the `/offboarding3` handler body (lines 313-360):

```ts
  privateBot.command('offboarding3', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      ctx.reply("You're not allowed to do that");

      return;
    }

    let balances: Map<number, number>;

    try {
      balances = await getOffboardingBalances();
    } catch (error) {
      loggers.errorWithContext(error as Error, '/offboarding3 sheet read');
      await ctx.reply(`Failed to read offboarding sheet: ${(error as Error).message}`);

      return;
    }

    const mbwayNumber = process.env.MBWAY_NUMBER ?? '';
    const iban = process.env.BANK_IBAN ?? '';
    let sent = 0;
    let failed = 0;

    for (const [userId, amount] of balances) {
      try {
        const user = getUserById(db, userId);
        const locale = (user?.preferred_language as 'en' | 'pt') ?? 'pt';
        const absAmount = Math.abs(amount).toFixed(2);
        const owesMoney = amount < 0;

        if (owesMoney) {
          const message = i18n.translate(locale, 'offboarding-final-pay', {
            amount: absAmount,
            mbwayNumber,
            iban,
          });
          const revolutUrl = buildRevolutPaymentLink(
            user?.name ?? '',
            Number(absAmount),
            'PDC_2026_Settlement',
          );
          const paypalUrl = buildPaypalPaymentLink(
            process.env.PAYPAL_ME_USERNAME ?? '',
            Number(absAmount),
          );
          const paymentKeyboard = new InlineKeyboard()
            .url(i18n.translate(locale, 'onboarding-btn-pay-revolut'), revolutUrl)
            .url(i18n.translate(locale, 'offboarding-btn-pay-paypal'), paypalUrl);

          await bot.api.sendMessage(userId, message, {
            parse_mode: 'HTML',
            reply_markup: paymentKeyboard,
          });
        } else {
          const message = i18n.translate(locale, 'offboarding-final-receive', {
            amount: absAmount,
            mbwayNumber,
          });

          await bot.api.sendMessage(userId, message, { parse_mode: 'HTML' });
        }

        sent++;
      } catch (error) {
        loggers.errorWithContext(error as Error, `/offboarding3 DM to user ${userId}`);
        failed++;
      }
    }

    const summary = i18n.translate('en', 'offboarding-admin-summary', { sent, failed });

    await ctx.reply(summary);
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/botsCommands/adminCommands.test.ts`
Expected: PASS — all tests in the file passing, including the `'should count failed DMs in summary'` test (unmodified — `getUserById` returns `undefined`, so `user?.name ?? ''` safely degrades to the `'user'` fallback inside `buildRevolutPaymentLink`, no throw).

- [ ] **Step 5: Update FTL text**

In `src/locales/en.ftl`, replace `offboarding-final-pay` (around lines 272-281):

```
offboarding-final-pay =
    The final settlement is confirmed. You owe <b>€{$amount}</b>.

    Please transfer to Daniel Azeiteiro using one of these options:
    • Bank transfer: {$iban}
    • MBWay: {$mbwayNumber}

    Or use the buttons below to pay via Revolut or PayPal.

    Thank you! 🙏
```

Add a new key after `offboarding-admin-summary` (around line 283):

```
offboarding-btn-pay-paypal = Pay via PayPal
```

In `src/locales/pt.ftl`, replace `offboarding-final-pay` (around lines 272-281):

```
offboarding-final-pay =
    O acerto final está confirmado. Deves <b>€{$amount}</b>.

    Por favor transfere para o Daniel Azeiteiro usando uma destas opções:
    • Transferência bancária: {$iban}
    • MBWay: {$mbwayNumber}

    Ou usa os botões abaixo para pagar via Revolut ou PayPal.

    Obrigado! 🙏
```

Add a new key after `offboarding-admin-summary` (around line 283):

```
offboarding-btn-pay-paypal = Pagar via PayPal
```

- [ ] **Step 6: Add the new env vars to `.env.example`**

In `.env.example`, after the `PAYMENT_AMOUNT=50` line added in Task 2, add:

```

# PayPal.me handle used for offboarding settlement payment links (e.g. azeiteiro)
PAYPAL_ME_USERNAME=

# Bank IBAN auto-included in the offboarding settlement message.
# Never commit this with a real value.
BANK_IBAN=
```

- [ ] **Step 7: Run the full test suite to confirm no regressions**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest`
Expected: PASS — all suites green.

- [ ] **Step 8: Commit**

```bash
git add src/botsCommands/adminCommands.ts src/__tests__/botsCommands/adminCommands.test.ts src/locales/en.ftl src/locales/pt.ftl .env.example
git commit -m "feat: add pre-filled Revolut/PayPal buttons and IBAN to offboarding settlement"
```

---

## Self-Review

**Spec coverage:**
- Onboarding pre-filled Revolut link, `PAYMENT_AMOUNT` env var + fallback/warn, amount text interpolation → Task 2.
- Offboarding Revolut + PayPal buttons, `PAYPAL_ME_USERNAME`, `BANK_IBAN`, bullet-list restructure, `offboarding-final-receive` unaffected → Task 3.
- Shared `buildRevolutPaymentLink`/`buildPaypalPaymentLink` pure functions + full unit test matrix (diacritics, whitespace, punctuation, empty fallback, custom noteLabel, rounding) → Task 1.
- `environment.ts` intentionally untouched (Global Constraints) — matches spec's "no new required-field validation" note.
- Out of Scope items (dynamic year, retroactive messages, payment reconciliation, `/offboarding1`/`/offboarding2`, buttons on `offboarding-final-receive`) — no tasks touch these, consistent with spec.

**Placeholder scan:** No TBD/TODO markers; every step has complete, runnable code and exact file paths/line numbers.

**Type consistency:** `buildRevolutPaymentLink(name: string, amountEuros: number, noteLabel?: string): string` and `buildPaypalPaymentLink(paypalUsername: string, amountEuros: number): string` signatures are identical everywhere they're defined (Task 1) and called (Task 2, Task 3).
