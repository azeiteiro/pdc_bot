# Pre-filled Payment Links (Onboarding Revolut + Offboarding Settlement)

## Context

**Onboarding:** When a user completes the onboarding form,
`onboardingConversation.ts` moves them to `WAITING_PAYMENT` status and sends
payment instructions (`onboarding-payment-instructions`) with an inline "Pay
with Revolut" button. Today that button links to the bare profile URL
`https://revolut.me/azeiteiro` and the €50 amount is only mentioned as plain
text — the user still has to manually enter the amount and a reference note
inside the Revolut app.

**Offboarding:** `/offboarding3` (`adminCommands.ts:312-360`) sends final
settlement messages. Users who owe money get `offboarding-final-pay`, which
lists payment options as plain, non-actionable text bullets (Bank transfer —
"ask Daniel for IBAN", PayPal, MBWay, Revolut) with no links or buttons at
all — not even the bare Revolut URL onboarding used to have.

Both Revolut and PayPal.me support deep-link query parameters that pre-fill
the payment screen with an amount and reference, e.g.:
- Revolut: `https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_Joao_Silva`
- PayPal.me: `https://paypal.me/azeiteiro/25.50EUR`

This spec covers pre-filling both the onboarding join-fee payment and the
offboarding settlement payment.

## Requirements

### Onboarding (join-fee payment)

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
- The MBWay instructions/number in onboarding are unchanged.

### Offboarding (settlement payment, `/offboarding3` only)

- Scope is limited to `offboarding-final-pay` (users who owe money).
  `offboarding-final-receive` (users owed money) is unaffected — they're not
  paying anything.
- The message gains two inline keyboard buttons: **Pay via Revolut** and
  **Pay via PayPal**, both pre-filled with the user's actual owed amount
  (the per-user settlement amount from the offboarding spreadsheet, not the
  fixed onboarding `PAYMENT_AMOUNT`).
- The Revolut settlement link reuses the same sanitized-name logic as
  onboarding, but with a distinguishing note prefix:
  `PDC_2026_Settlement_<sanitized name>` (vs. onboarding's plain
  `PDC_2026_<sanitized name>`), so Daniel can tell join-fee payments and
  settlement payments apart in his Revolut transaction list.
- A new `PAYPAL_ME_USERNAME` env var (e.g. `azeiteiro`) configures the
  PayPal.me handle used to build `https://paypal.me/<username>/<amount>EUR`.
- A new `BANK_IBAN` env var is introduced and auto-included in the bank
  transfer bullet (replacing "ask Daniel for IBAN"), accepting the small
  SEPA-mandate exposure risk in exchange for a fully automated message (this
  trade-off was discussed and explicitly chosen — see Context above). Like
  other secrets, it lives only in `.env` (never committed) and is documented
  in `.env.example` with a placeholder, not a real value.
- Since Revolut and PayPal become buttons, the corresponding bullet lines
  are removed from the message text to avoid duplication. The remaining
  bullets (Bank transfer with IBAN, MBWay) stay as plain text since they
  have no deep-link equivalent.

## Design

### Architecture

New module: **`src/utils/paymentLink.ts`**

```ts
export function buildRevolutPaymentLink(
  name: string,
  amountEuros: number,
  noteLabel: string = 'PDC_2026',
): string

export function buildPaypalPaymentLink(
  paypalUsername: string,
  amountEuros: number,
): string
```

Both are pure functions with no I/O or side effects.

**`buildRevolutPaymentLink`:**

1. Sanitize `name`:
   - Normalize and strip diacritics (`name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`).
   - Replace any run of whitespace with a single `_`.
   - Remove any character that isn't `[A-Za-z0-9_]`.
   - Collapse repeated `_` and trim leading/trailing `_`.
   - Fall back to `'user'` if the result is empty.
2. Build the note: `` `${noteLabel}_${sanitizedName}` ``.
   - Onboarding calls this with the default `noteLabel` → `PDC_2026_<name>`.
   - Offboarding calls this with `noteLabel: 'PDC_2026_Settlement'` →
     `PDC_2026_Settlement_<name>`.
3. Convert `amountEuros` to cents: `Math.round(amountEuros * 100)`.
4. Return:
   `` `https://revolut.me/azeiteiro?currency=EUR&amount=${cents}&note=${encodeURIComponent(note)}` ``.

**`buildPaypalPaymentLink`:**

1. Format `amountEuros` to 2 decimal places (`amountEuros.toFixed(2)`).
2. Return `` `https://paypal.me/${paypalUsername}/${formattedAmount}EUR` ``.
   No sanitization needed on `paypalUsername` — it's admin-controlled config
   (`PAYPAL_ME_USERNAME`), not user input.

### Files touched

- **`src/utils/paymentLink.ts`** (new) — both functions above.
- **`src/__tests__/utils/paymentLink.test.ts`** (new) — unit tests, see
  Testing.
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
- **`src/botsCommands/adminCommands.ts`** (`/offboarding3`, lines ~335-355)
  - For each user with a negative balance (`messageKey ===
    'offboarding-final-pay'`):
    - Build `revolutUrl = buildRevolutPaymentLink(user?.name ?? '',
      Number(absAmount), 'PDC_2026_Settlement')`.
    - Build `paypalUrl = buildPaypalPaymentLink(process.env.PAYPAL_ME_USERNAME
      ?? '', Number(absAmount))`.
    - Send with an `InlineKeyboard` with two buttons (Revolut, PayPal)
      instead of no `reply_markup`.
    - Pass `iban: process.env.BANK_IBAN ?? ''` into the translate call.
  - Users with a positive balance (`offboarding-final-receive`) are
    unchanged — plain `sendMessage`, no keyboard.
- **`src/locales/en.ftl`** / **`src/locales/pt.ftl`**
  - `onboarding-payment-instructions`: replace the literal `€50` with
    `€{$amount}`.
  - `offboarding-final-pay`: remove the `• PayPal` and `• Revolut` bullets;
    change `• Bank transfer (ask Daniel for IBAN)` to
    `• Bank transfer: {$iban}`; keep `• MBWay: {$mbwayNumber}`.
  - New key `offboarding-btn-pay-paypal` (button label, e.g. "Pay via
    PayPal" / "Pagar via PayPal"). `onboarding-btn-pay-revolut` is reused
    as-is for the Revolut button in both flows.
- **`.env.example`**
  - Add `PAYMENT_AMOUNT=50` next to `MBWAY_NUMBER` (whole euros, used in
    both the onboarding text and the Revolut deep link).
  - Add `PAYPAL_ME_USERNAME=` (offboarding settlement PayPal handle).
  - Add `BANK_IBAN=` with a comment noting it's auto-included in the
    offboarding settlement message and must never be committed with a real
    value.
- **`src/config/environment.ts`**
  - No new required-field validation — all three new vars stay optional
    with safe fallbacks/empty-string behavior, consistent with
    `MBWAY_NUMBER`.

### Data Flow

**Onboarding:**

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

**Offboarding (`/offboarding3`):**

1. Admin runs `/offboarding3`. `getOffboardingBalances()` returns a
   `Map<userId, amount>`.
2. For each user with `amount < 0` (they owe money):
   - `absAmount = Math.abs(amount).toFixed(2)` (unchanged).
   - `revolutUrl = buildRevolutPaymentLink(user?.name ?? '', Number(absAmount), 'PDC_2026_Settlement')`
     → e.g. `https://revolut.me/azeiteiro?currency=EUR&amount=2550&note=PDC_2026_Settlement_Joao_Silva`.
   - `paypalUrl = buildPaypalPaymentLink(process.env.PAYPAL_ME_USERNAME ?? '', Number(absAmount))`
     → e.g. `https://paypal.me/azeiteiro/25.50EUR`.
   - Message sent with `reply_markup` containing both buttons, and `iban`/
     `mbwayNumber` interpolated into the (now shorter) bullet list.
3. For each user with `amount >= 0` (they're owed money): unchanged, plain
   `offboarding-final-receive` message, no buttons.

### Error Handling

- Invalid/missing `PAYMENT_AMOUNT` (non-numeric, empty) falls back to `50`
  and logs a warning — never throws, never blocks the onboarding flow.
- Missing `PAYPAL_ME_USERNAME` or `BANK_IBAN` result in an empty string
  interpolated into the link/text (matching existing `MBWAY_NUMBER ?? ''`
  behavior) rather than throwing — the button would link to
  `https://paypal.me//25.50EUR` in that edge case, which is a pre-existing
  class of "admin forgot to configure this" issue already present for
  `MBWAY_NUMBER`, not a new failure mode introduced here.
- `buildRevolutPaymentLink` and `buildPaypalPaymentLink` are pure string
  functions; they cannot fail at runtime (no network/DB calls). An empty or
  missing name safely degrades to the `user` fallback rather than producing
  a malformed note.
- No changes to existing error handling around `addOnboardingData`, the
  offboarding sheet read (`getOffboardingBalances`), or per-user DM
  send/catch loops — those try/catch blocks are untouched.

### Testing

New tests in `src/__tests__/utils/paymentLink.test.ts`:

- `buildRevolutPaymentLink`:
  - Plain ASCII name (e.g. `"John Smith"`) → note `PDC_2026_John_Smith`.
  - Accented name (e.g. `"João Silva"`) → note `PDC_2026_Joao_Silva`.
  - Name with extra/irregular whitespace (e.g. `"  Ana   Costa "`) → note
    `PDC_2026_Ana_Costa`.
  - Name with punctuation (e.g. `"Anne-Marie O'Neil"`) → punctuation
    stripped, underscores collapsed correctly.
  - Empty or whitespace-only name → falls back to `PDC_2026_user`.
  - Custom `noteLabel` param (e.g. `'PDC_2026_Settlement'`) → note becomes
    `PDC_2026_Settlement_<name>`.
  - Amount conversion: `50` → `amount=5000`; a fractional euro amount (e.g.
    `49.99`) rounds to the nearest cent (`4999`).
  - Full URL shape assertion (query params present and correctly ordered:
    `currency`, `amount`, `note`).
- `buildPaypalPaymentLink`:
  - `('azeiteiro', 25.5)` → `https://paypal.me/azeiteiro/25.50EUR`.
  - Amount rounds/formats to exactly 2 decimals (e.g. `25` →
    `25.00EUR`).

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

Updates to `src/__tests__/botsCommands/adminCommands.test.ts` (offboarding3
tests):

- The existing "should send final messages for positive and negative
  amounts" test (balances `[1, 100.0]`, `[2, -25.5]`) gets new assertions:
  - For user `2` (negative balance, owes money): `bot.api.sendMessage` was
    called with a `reply_markup` containing two buttons, whose URLs contain
    `PDC_2026_Settlement_` (Revolut) and `paypal.me/` + `25.50EUR`
    (PayPal), respectively.
  - For user `1` (positive balance, owed money): `bot.api.sendMessage` was
    called with no `reply_markup` (or `undefined`), confirming buttons only
    appear on the "owes money" path.
- The "should count failed DMs in summary" test (`getUserById` returns
  `undefined` for user `99`) still passes unmodified — `user?.name ?? ''`
  degrades to the `buildRevolutPaymentLink` empty-name fallback (`user`),
  which doesn't throw.

All new/changed behavior is implemented test-first (RED → GREEN → REFACTOR)
per project convention.

## Out of Scope

- Making the note's year (`2026`) dynamic or configurable, in either flow.
- Retroactively updating messages already sent to users currently in
  `WAITING_PAYMENT`, or already-sent offboarding settlement messages — this
  only affects future messages going forward.
- Verifying payment status or reconciling notes/references against actual
  Revolut/PayPal transactions — this remains a fully manual admin process
  (`/confirm <userId>` for onboarding; no equivalent confirmation command
  exists for offboarding settlements today, and adding one is out of scope).
- Adding a Revolut/PayPal/IBAN button or link to `offboarding-final-receive`
  (users owed money) — not applicable, they're not paying anyone.
- Changes to `/offboarding1` or `/offboarding2`.
