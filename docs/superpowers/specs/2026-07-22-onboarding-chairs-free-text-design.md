# Onboarding Chairs Question: Accept Free Text Directly

## Problem

In the onboarding conversation, the chairs question (`numeroCadeiras`) presents buttons `0`/`1`/`2`/`3` plus an explicit "🪑 Other" button. Free-text numeric input is only accepted *after* the user clicks "Other" — typing a number directly, without clicking anything, is ignored (the step waits exclusively for a callback via `waitForCallbackOrExit`).

This is inconsistent with the departure-location question (`localPartida`), which shows 3 placeholder buttons (Lisboa/Porto/Coimbra) but *also* accepts free text at any time, with no dedicated "Other" button or extra prompt step.

## Decision

Make the chairs question behave like departure location: keep the `0`/`1`/`2`/`3` buttons, drop the "Other" button, and accept typed numeric input directly at any time. Validation (must be a valid whole number ≥ 0) and the retry-on-invalid-input loop are preserved exactly as they exist today — only the entry point changes (no click needed to unlock text input).

## Changes

### `src/conversations/onboardingConversation.ts`

- Chairs keyboard (`InlineKeyboard`) drops the `.text(t('onboarding-btn-chairs-other'), 'chairs_other')` button, keeping only `0`/`1`/`2`/`3`.
- Replace the callback-only wait (`waitForCallbackOrExit(..., ['chairs_0', 'chairs_1', 'chairs_2', 'chairs_3', 'chairs_other'])`) with a loop using `waitOrExit` (the same helper the departure-location step uses), which accepts either update type per iteration:
  - A callback whose `data` starts with `chairs_` → extract the number directly from the callback data (`chairs_0` → `'0'`, etc.).
  - Otherwise, treat the update as free text: parse and validate exactly as today (`Number(text)`, reject non-integers and negatives), reply with `onboarding-chairs-invalid` and loop again on invalid input, or accept and exit the loop on valid input.
- The intermediate "please enter the number of chairs" prompt (shown today only after clicking "Other") is removed — the initial chairs question message already implies both options are available, matching how departure location's initial prompt works.

### `src/locales/en.ftl` / `src/locales/pt.ftl`

- Remove `onboarding-btn-chairs-other` (no longer referenced — no "Other" button exists).
- Remove `onboarding-chairs-enter` (no longer referenced — no separate "enter a number" step exists).
- `onboarding-chairs-question` and `onboarding-chairs-invalid` are unchanged.

### `src/__tests__/conversations/onboardingConversation.test.ts`

- "should collect chair count from a quick-reply button and include it in the summary" — unchanged (still exercises the `chairs_2` callback path).
- "should prompt for a custom count when Other is selected and accept a valid number" — updated to send the number as free text directly (no `chairs_other` click first), renamed to reflect the new behavior (e.g. "should accept a typed chair count directly without clicking a button").
- "should reject invalid custom chair counts and retry until a valid one is given" — updated to send the invalid/valid text values directly (no `chairs_other` click first).
- "should exit when the user cancels during the chairs step" — unchanged; the cancel-detection logic (`isEscapeCommand`) lives inside `waitOrExit` regardless of which step calls it.

## Out of Scope

- The departure-location question itself is not modified.
- No new env vars, no DB/schema changes, no other onboarding steps touched.
- No changes to `onboarding-chairs-invalid` wording or validation rules (still: integer ≥ 0).

## Testing

Existing Jest suite (`NODE_OPTIONS=--experimental-vm-modules npx jest`) covers this via `onboardingConversation.test.ts`; no new test infrastructure needed, only updates to the two "Other"-path tests as described above.
