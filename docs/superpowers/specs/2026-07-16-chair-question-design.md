# Add Chair-Count Question to Onboarding

## Context

The onboarding conversation (`src/conversations/onboardingConversation.ts`)
walks new users through name, arrival/departure dates, car ownership,
departure location, additional info, and a final summary/confirmation before
their data is pushed to a Google Sheet. Some attendees bring their own chairs
to the festival, and organizers want to know how many chairs to expect per
user, tracked alongside the other onboarding answers.

Additionally, the departure location question is currently only asked when
the user says they have a car (`if (hasCar) { ... } else { data.localPartida
= ''; } `), but organizers want this question asked of everyone regardless of
car ownership.

## Requirements

- Insert a new "how many chairs are you bringing?" question into the
  onboarding flow, positioned right after the departure location question and
  before the additional info question.
- The question is answered via four quick-reply buttons for 0, 1, 2, and 3
  chairs, plus an "Other" button for values outside that range.
- Selecting "Other" prompts the user to type a number. Any whole number ≥ 0 is
  accepted; invalid input (non-numeric, negative, or non-integer) shows a
  validation error and re-prompts, matching the retry pattern used for expense
  amount validation (`expense-invalid-amount`).
- The departure location question becomes unconditional: it is always asked,
  regardless of whether the user said they have a car. The existing wording
  (`onboarding-departure-location = Where will you be departing from?`) is
  already car-agnostic, so no copy changes are needed for this question
  itself.
- The chair count is included in the summary/confirmation message shown to
  the user before submission.
- The chair count is written to the Google Sheet as a new "Cadeiras" column,
  matching the sheet's real column order:
  `Nome | Data chegada | Data de partida | Leva carro? | Local partida |
  Cadeiras | Tenda entregue | Observações | Telegram User ID`. This is a
  going-forward change only; historical rows are out of scope.
- The chair count is not persisted to SQLite, consistent with how car
  ownership, departure location, and additional info are currently handled
  (sheet-only, no local DB column).

## Design

### Architecture

New onboarding step order:

Name → Arrival date → Departure date → Car question → Departure location
(now always asked) → **NEW: Chairs question** → Additional info → Summary →
Data persistence.

Files touched:

- **`src/conversations/onboardingConversation.ts`**
  - Remove the `if (hasCar) { ... } else { data.localPartida = ''; }` gate
    around the departure location step; the location step's body (buttons +
    free-text fallback) runs unconditionally.
  - Add a new chairs step between the departure location step and the
    additional info step.
  - Add `numeroCadeiras: string` to the local `OnboardingData` interface.
  - Add `chairs: data.numeroCadeiras` to the `onboarding-summary`
    interpolation.
- **`src/googleApi/googleSheetsApi.ts`**
  - Add `numeroCadeiras: string` to the exported `OnboardingData` interface.
  - Reorder the `values` array written to the sheet to
    `[nome, dataChegada, dataPartida, levaCarro, localPartida,
    numeroCadeiras, 'Não', observacoes, String(userId)]`.
  - Widen the append range from `A:H` to `A:I`.
- **`src/locales/en.ftl`** / **`src/locales/pt.ftl`**
  - New keys: `onboarding-chairs-question`, `onboarding-btn-chairs-other`,
    `onboarding-chairs-enter` (prompt for the custom number),
    `onboarding-chairs-invalid` (validation error). The 0/1/2/3 buttons use
    literal numeric strings as their labels (`'0'`, `'1'`, `'2'`, `'3'`), the
    same pattern already used for the Lisboa/Porto/Coimbra location buttons
    (hardcoded text, not routed through `t()`), so no locale keys are needed
    for them.
  - Update `onboarding-summary` to add a `Chairs: {$chairs}` line, following
    the existing `Car: {$car}` line style (always shown, not conditional).
- **`src/__tests__/conversations/onboardingConversation.test.ts`**
  - New tests for the chairs step; updates to existing tests affected by the
    departure-location gate removal and the new step in the sequence.

### Data Flow

**Chairs step:**

1. Bot sends `onboarding-chairs-question` with an inline keyboard: four
   buttons labeled 0, 1, 2, 3 (callback data e.g. `chairs_0` … `chairs_3`),
   plus one "Other" button (callback data `chairs_other`).
2. `waitForCallbackOrExit(conversation, ctx, t, ['chairs_0', 'chairs_1',
   'chairs_2', 'chairs_3', 'chairs_other'])` waits for a button press or an
   escape command (`/cancel`, `/onboarding`).
3. If the user pressed 0/1/2/3: `data.numeroCadeiras` is set directly from
   the button (e.g. `'0'`, `'1'`, `'2'`, `'3'`).
4. If the user pressed "Other": bot sends `onboarding-chairs-enter` (no
   keyboard) and waits for a text reply via `waitOrExit(conversation, ctx,
   t)`.
   - Parse the reply with `Number(text)`.
   - Valid when `!isNaN(value)`, `Number.isInteger(value)`, and `value >= 0`.
   - If valid: `data.numeroCadeiras = String(value)`.
   - If invalid: reply with `onboarding-chairs-invalid` and loop back to
     waiting for text (same retry pattern as `addExpenseConversation.ts`'s
     amount validation), until a valid value is entered or the user escapes.

**Departure location step (updated):**

The existing button/free-text logic (Lisboa/Porto/Coimbra buttons, or
free-text fallback into `data.localPartida`) is unchanged, but it is no
longer wrapped in `if (hasCar) { ... } else { data.localPartida = ''; }` — it
always runs after the car question, regardless of the car answer.

**Summary step (updated):**

```ts
const summaryMessage = t('onboarding-summary', {
  name: data.nome,
  arrival: data.dataChegada,
  departure: data.dataPartida,
  car: data.levaCarro,
  departureLocation: data.localPartida || 'empty',
  chairs: data.numeroCadeiras,
  additionalInfo: data.observacoes || 'empty',
});
```

**Sheet write (updated):**

```ts
const values = [
  [
    data.nome,
    data.dataChegada,
    data.dataPartida,
    data.levaCarro,
    data.localPartida,
    data.numeroCadeiras, // Cadeiras
    'Não', // Tenda entregue
    data.observacoes, // Observações
    String(data.userId), // Telegram User ID
  ],
];
// range: `${process.env.ONBOARDING_SHEET_ID}!A:I`
```

### Error Handling

- Invalid custom chair count (non-numeric, negative, or non-integer) shows
  `onboarding-chairs-invalid` and re-prompts for text input, mirroring the
  numeric validation retry loop already used for expense amounts.
- Cancellation at any point during the chairs step (typing `/cancel` or
  `/onboarding`) is handled entirely by the existing
  `waitForCallbackOrExit`/`waitOrExit` helpers — no new cancellation logic is
  needed.
- Google Sheets write failures are already caught and logged in
  `addOnboardingData`'s existing try/catch; this behavior is unchanged.
- No SQLite schema or repository changes are needed, since chair count only
  flows into the Google Sheet, matching how car ownership, departure
  location, and additional info are already handled.

### Testing

New tests in `onboardingConversation.test.ts`:

- Pressing each of the 0/1/2/3 buttons sets `numeroCadeiras` to the matching
  string value and proceeds to the additional info step.
- Pressing "Other" then typing a valid non-negative integer sets
  `numeroCadeiras` to that value and proceeds.
- Pressing "Other", typing invalid input (e.g. `"abc"`, `"-1"`, `"1.5"`)
  shows `onboarding-chairs-invalid` and re-prompts; then typing a valid value
  proceeds.
- Typing `/cancel` during the chairs step exits the conversation early
  (matching the existing cancellation test pattern for other steps).

Updates to existing tests in `onboardingConversation.test.ts`:

- The full happy-path flow test needs the new chairs step inserted into its
  mocked `conversation.wait()` sequence, and its final sheet-write assertion
  updated to the new column order (`numeroCadeiras` before `'Não'`,
  `observacoes`, `String(userId)`).
- Existing departure-location tests for the `hasCar === false` branch are
  updated, since that branch no longer skips the location question — the
  test should assert the location step runs and its result is stored in
  `data.localPartida` regardless of the car answer.

`addOnboardingData` (in `googleSheetsApi.ts`), if covered by a unit test
today, gets its expected `values` array and `range` updated to match the new
column order (`A:I`, with `numeroCadeiras` inserted before the tent/notes/
userId columns). If no such test exists yet, one is added to lock in the
correct column order going forward.

All new/changed behavior is implemented test-first (RED → GREEN → REFACTOR)
per project convention.

## Out of Scope

- Correcting historical rows already written to the spreadsheet with the old,
  misaligned column order. The user will handle this separately.
- Any changes to the "Tenda entregue" (tent delivered) column's value or
  logic — it continues to be hardcoded to `'Não'`, just written into the
  correct column position.
- Persisting chair count (or any other onboarding answer) to SQLite.
- Changes to `commands.json`, admin commands, or any other onboarding step
  not mentioned above.
