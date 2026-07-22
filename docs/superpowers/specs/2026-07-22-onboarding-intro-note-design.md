# Onboarding Intro Reassurance Note

## Problem

Users going through onboarding sometimes message the admin afterwards saying things like "I'm still not sure when I'm going" — worried that answers like arrival/departure dates need to be final. Nothing in the current flow tells them their submission can be changed later.

## Decision

Send a single reassurance message at the very start of the onboarding conversation, before the first question (name confirmation), telling the user their answers are stored in a spreadsheet and can be updated later.

## Copy

- EN (`onboarding-intro-note`): "Don't worry if you're not 100% sure about some answers yet — everything is saved to a spreadsheet and can be updated later. Just answer as best you can for now."
- PT (`onboarding-intro-note`): "Não te preocupes se ainda não tens a certeza de algumas respostas — tudo fica guardado numa folha de cálculo e pode ser alterado mais tarde. Responde como conseguires por agora."

## Changes

### `src/conversations/onboardingConversation.ts`

Add `await ctx.reply(t('onboarding-intro-note'));` immediately after the `data: OnboardingData` object is initialized, before the "Step 1: Name confirmation" block. No new state, no keyboard/buttons, no branching.

### `src/locales/en.ftl` / `src/locales/pt.ftl`

Add the new `onboarding-intro-note` key under the "Conversation Steps" section, immediately before `onboarding-name-confirm`.

### `src/__tests__/conversations/onboardingConversation.test.ts`

The full-flow tests currently assert on specific `mockCtx.reply` calls / callback sequences; since this adds one extra `ctx.reply` call at the very start (with no corresponding `conversation.wait()`), existing tests that assert exact reply call counts or ordering need to account for the new first reply. Add one new assertion (in the main "should complete full onboarding flow" test) confirming `ctx.reply` was called with `'onboarding-intro-note'` before the name-confirmation reply.

## Out of Scope

- No change to the `/start` welcome message.
- No change to date-question copy specifically (this is a general upfront note, not per-question help text).
- No env vars, no DB/schema changes.

## Testing

Existing Jest suite (`NODE_OPTIONS=--experimental-vm-modules npx jest`) covers this via `onboardingConversation.test.ts`; verify the new reply is sent first and doesn't break any existing mocked `conversation.wait()` sequencing (it doesn't consume a `wait()` call, since it's a `ctx.reply` with no corresponding wait).
