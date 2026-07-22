# Pre-filled Revolut Payment Link

## Context

When a user completes the onboarding form, `onboardingConversation.ts` moves
them to `WAITING_PAYMENT` status and sends payment instructions
(`onboarding-payment-instructions`) with an inline "Pay with Revolut" button.
Today that button links to the bare profile URL `https://revolut.me/azeiteiro`
and the €50 amount is only mentioned as plain text in the message — the user
still has to manually enter the amount and a reference note inside the
Revolut app. Revolut supports deep-link query parameters
(`currency`, `amount` in cents, `note`) that pre-fill the payment screen,
e.g. `https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_Joao_Silva`.

## Requirements

- The Revolut button sent during onboarding links to a pre-filled payment URL
  including currency (`EUR`), amount, and a note identifying the payer.
- The payment amount is configurable via a new `PAYMENT_AMOUNT` env var,
  expressed in whole euros (e.g. `50`), matching the style of the existing
  `MBWAY_NUMBER` env var. If unset or invalid, it defaults to `50` and a
  warning is logged (consistent with how other optional env vars degrade,
  e.g. `OFFBOARDING_SHEET_ID` in `environment.ts`).
- The note is built as `PDC_2026_<sanitized user name>`. The year (`2026`) is
  a hardcoded literal for this season; updating it next year is a small code
  change, not a config change.
- The user's name (`data.nome`, collected earlier in onboarding) is sanitized
  for use in the note: diacritics stripped (e.g. `João` → `Joao`), whitespace
  collapsed to single underscores, and any character outside
  `[A-Za-z0-9_]` removed. If sanitization results in an empty string, the
  note falls back to `PDC_2026_user`.
- The payment instructions text (`onboarding-payment-instructions`, both
  `en.ftl` and `pt.ftl`) is updated to interpolate the same amount
  (`€{$amount}`) instead of the hardcoded `€50`, so the displayed price and
  the pre-filled link amount can never drift out of sync.
- The MBWay instructions/number are unchanged — this feature only affects the
  Revolut link and the amount shown in text.

## Design

### Architecture

New module: **`src/utils/paymentLink.ts`**

```ts
export function buildRevolutPaymentLink(name: string, amountEuros: number): string
```

A pure function with no I/O or side effects:

1. Sanitize `name`:
   - Normalize and strip diacritics (`name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`).
   - Replace any run of whitespace with a single `_`.
   - Remove any character that isn't `[A-Za-z0-9_]`.
   - Collapse repeated `_` and trim leading/trailing `_`.
   - Fall back to `'user'` if the result is empty.
2. Build the note: `` `PDC_2026_${sanitizedName}` ``.
3. Convert `amountEuros` to cents: `Math.round(amountEuros * 100)`.
4. Return:
   `` `https://revolut.me/azeiteiro?currency=EUR&amount=${cents}&note=${encodeURIComponent(note)}` ``.

### Files touched

- **`src/utils/paymentLink.ts`** (new) — `buildRevolutPaymentLink` as above.
- **`src/__tests__/utils/paymentLink.test.ts`** (new) — unit tests, see Testing.
- **`src/conversations/onboardingConversation.ts`**
  - Where the payment message is currently built (around the
    `updateUserStatus(db, userId, 'WAITING_PAYMENT')` step):
    - Parse `PAYMENT_AMOUNT` from env: `Number(process.env.PAYMENT_AMOUNT)`,
      falling back to `50` when `NaN` or unset, logging a warning on
      fallback (once per call, matching existing logger usage in this file).
    - Replace the hardcoded button URL with
      `buildRevolutPaymentLink(data.nome, paymentAmount)`.
    - Pass `amount: String(paymentAmount)` into the
      `t('onboarding-payment-instructions', { mbwayNumber, amount })` call.
- **`src/locales/en.ftl`** / **`src/locales/pt.ftl`**
  - `onboarding-payment-instructions`: replace the literal `€50` with
    `€{$amount}`.
- **`.env.example`**
  - Add `PAYMENT_AMOUNT=50` next to `MBWAY_NUMBER`, with a comment
    describing it's in whole euros and used both in the payment text and the
    Revolut deep link.
- **`src/config/environment.ts`**
  - No new required-field validation (this stays optional, defaulting
    silently like `MBWAY_NUMBER`); no changes needed here since there's no
    existing warning list entry pattern required for vars that have a safe
    runtime default (unlike `OFFBOARDING_SHEET_ID`, which has no default and
    breaks a command entirely if missing).

### Data Flow

1. User finishes the onboarding summary/confirmation step.
2. `onboardingConversation.ts` writes the sheet row and calls
   `updateUserStatus(db, userId, 'WAITING_PAYMENT')` (unchanged).
3. `paymentAmount` is resolved from `process.env.PAYMENT_AMOUNT` (fallback
   `50`).
4. `buildRevolutPaymentLink(data.nome, paymentAmount)` produces the full URL,
   e.g. for `data.nome = "João Silva"` and `paymentAmount = 50`:
   `https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_Joao_Silva`.
5. The `InlineKeyboard` button uses this URL instead of the bare profile
   link.
6. `ctx.reply(t('onboarding-payment-instructions', { mbwayNumber, amount: '50' }), ...)`
   sends text showing `€50`, matching the link's amount.

### Error Handling

- Invalid/missing `PAYMENT_AMOUNT` (non-numeric, empty) falls back to `50`
  and logs a warning — never throws, never blocks the onboarding flow.
- `buildRevolutPaymentLink` is a pure string function; it cannot fail at
  runtime (no network/DB calls). An empty/whitespace-only name safely
  degrades to the `user` fallback rather than producing a malformed note.
- No changes to existing error handling around `addOnboardingData` (Google
  Sheets write) or the payment message send — those try/catch blocks are
  untouched.

### Testing

New tests in `src/__tests__/utils/paymentLink.test.ts`:

- Plain ASCII name (e.g. `"John Smith"`) → note `PDC_2026_John_Smith`.
- Accented name (e.g. `"João Silva"`) → note `PDC_2026_Joao_Silva`.
- Name with extra/irregular whitespace (e.g. `"  Ana   Costa "`) → note
  `PDC_2026_Ana_Costa`.
- Name with punctuation (e.g. `"Anne-Marie O'Neil"`) → punctuation stripped,
  underscores collapsed correctly.
- Empty or whitespace-only name → falls back to `PDC_2026_user`.
- Amount conversion: `50` → `amount=5000` in the URL; a fractional euro
  amount (e.g. `49.99`) rounds to the nearest cent (`4999`).
- Full URL shape assertion (query params present and correctly ordered:
  `currency`, `amount`, `note`).

Updates to `src/__tests__/conversations/onboardingConversation.test.ts`:

The existing "update user status to WAITING_PAYMENT on success" test already
asserts `ctx.reply` is called with `expect.stringContaining('onboarding-payment-instructions')`
and `reply_markup: expect.anything()` — it doesn't inspect the button URL or
the `t()` call's variables, so it keeps passing unmodified. New assertions
are added (not replacing existing ones) to lock in the new behavior:

- Assert the `InlineKeyboard`'s button URL contains the expected query
  string (`currency=EUR`, `amount=5000`, and a `note` containing
  `PDC_2026_John_Doe` for the mock user `{ first_name: 'John', last_name: 'Doe' }`
  used in that test).
- Assert `i18nMock.translate` (or the `t` wrapper) was called for
  `onboarding-payment-instructions` with an `amount` var equal to `'50'`
  (the `PAYMENT_AMOUNT` fallback, since it's unset in test env setup).

All new/changed behavior is implemented test-first (RED → GREEN → REFACTOR)
per project convention.

## Out of Scope

- Any changes to the MBWay number, instructions, or reference format.
- Making the note's year (`2026`) dynamic or configurable.
- Retroactively updating messages already sent to users currently in
  `WAITING_PAYMENT` — this only affects future payment messages going
  forward.
- Verifying payment status or reconciling the note against actual Revolut
  transactions — this remains a fully manual admin process
  (`/confirm <userId>`), unchanged.
