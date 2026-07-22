# Onboarding Intro Reassurance Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a single reassurance message at the very start of the onboarding conversation, before the first question, telling the user their answers are saved to a spreadsheet and can be updated later.

**Architecture:** Add one `await ctx.reply(t('onboarding-intro-note'))` call immediately after `data: OnboardingData` is initialized in `onboardingConversation`, before Step 1 (name confirmation) begins. No new state, no keyboard, no branching, no `conversation.wait()` call consumed.

**Tech Stack:** TypeScript, grammY conversations, Fluent (`.ftl`) i18n, Jest with `unstable_mockModule`.

## Global Constraints

- EN copy (`onboarding-intro-note`): "Don't worry if you're not 100% sure about some answers yet — everything is saved to a spreadsheet and can be updated later. Just answer as best you can for now."
- PT copy (`onboarding-intro-note`): "Não te preocupes se ainda não tens a certeza de algumas respostas — tudo fica guardado numa folha de cálculo e pode ser alterado mais tarde. Responde como conseguires por agora."
- The new key goes under the `# Conversation Steps` section, immediately before `onboarding-name-confirm`, in both `src/locales/en.ftl` and `src/locales/pt.ftl`.
- No new env vars, no DB/schema changes, no change to `/start` welcome message or date-question copy.

---

### Task 1: Add onboarding intro note

**Files:**
- Modify: `src/conversations/onboardingConversation.ts:124-126`
- Modify: `src/locales/en.ftl:91-92`
- Modify: `src/locales/pt.ftl:91-92`
- Test: `src/__tests__/conversations/onboardingConversation.test.ts:231-318`

**Interfaces:**
- Consumes: existing `t(key: string, vars?: TranslationVariables)` translator function already in scope inside `onboardingConversation` (`src/conversations/onboardingConversation.ts:114`); existing `ctx.reply` mock pattern from the test file.
- Produces: nothing new consumed by other tasks — this is the only task.

- [ ] **Step 1: Write the failing assertion**

In `src/__tests__/conversations/onboardingConversation.test.ts`, inside the `'should complete full onboarding flow with confirmation'` test (currently lines 231-318), add a new assertion right after the `await onboardingConversation(...)` call (currently line 288), before the existing `expect(googleSheets.addOnboardingData)...` assertion (currently line 290):

```typescript
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      expect(mockCtx.reply).toHaveBeenNthCalledWith(1, 'onboarding-intro-note');

      expect(googleSheets.addOnboardingData).toHaveBeenCalledWith({
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/conversations/onboardingConversation.test.ts -t "should complete full onboarding flow"`

Expected: FAIL — `expect(mockCtx.reply).toHaveBeenNthCalledWith(1, 'onboarding-intro-note')` fails because the 1st call is currently the name-confirmation reply, not the intro note.

- [ ] **Step 3: Add the FTL translation keys**

In `src/locales/en.ftl`, insert immediately after line 91 (`# Conversation Steps`) and before line 92 (`onboarding-name-confirm = ...`):

```fluent
onboarding-intro-note = Don't worry if you're not 100% sure about some answers yet — everything is saved to a spreadsheet and can be updated later. Just answer as best you can for now.

```

In `src/locales/pt.ftl`, insert immediately after line 91 (`# Conversation Steps`) and before line 92 (`onboarding-name-confirm = ...`):

```fluent
onboarding-intro-note = Não te preocupes se ainda não tens a certeza de algumas respostas — tudo fica guardado numa folha de cálculo e pode ser alterado mais tarde. Responde como conseguires por agora.

```

- [ ] **Step 4: Add the reply call in the conversation**

In `src/conversations/onboardingConversation.ts`, the `data` object is currently initialized as:

```typescript
  const data: OnboardingData = {
    nome: '',
    dataChegada: '',
    dataPartida: '',
    levaCarro: '',
    localPartida: '',
    numeroCadeiras: '',
    observacoes: '',
  };

  // Step 1: Name confirmation
```

Change it to:

```typescript
  const data: OnboardingData = {
    nome: '',
    dataChegada: '',
    dataPartida: '',
    levaCarro: '',
    localPartida: '',
    numeroCadeiras: '',
    observacoes: '',
  };

  await ctx.reply(t('onboarding-intro-note'));

  // Step 1: Name confirmation
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/conversations/onboardingConversation.test.ts -t "should complete full onboarding flow"`

Expected: PASS

- [ ] **Step 6: Run the full onboarding test file to check for regressions**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/conversations/onboardingConversation.test.ts`

Expected: all tests PASS. (Other tests only use `toHaveBeenCalledWith` on `mockCtx.reply`, not `toHaveBeenNthCalledWith(1, ...)` or `toHaveBeenCalledTimes`, so the extra leading reply call does not break them — verified by inspecting the file: only `mock.calls[0]` usage in the file is on `keyboardInstance.url`, not `mockCtx.reply`.)

- [ ] **Step 7: Run the full test suite**

Run: `LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest --silent`

Expected: all tests PASS, no failures.

- [ ] **Step 8: Commit**

```bash
git add src/conversations/onboardingConversation.ts src/locales/en.ftl src/locales/pt.ftl src/__tests__/conversations/onboardingConversation.test.ts
git commit -m "feat: add reassurance note at start of onboarding conversation"
```

## Self-Review

**1. Spec coverage:**
- ✅ Reassurance message sent before first question — Step 4.
- ✅ Exact EN/PT copy — Step 3.
- ✅ New key placed under "Conversation Steps" section before `onboarding-name-confirm` — Step 3.
- ✅ No new state/keyboard/branching — confirmed, `ctx.reply` call has no keyboard argument and doesn't consume a `conversation.wait()`.
- ✅ Test updated to assert the new reply happens first — Steps 1-2, 5.
- ✅ Out of scope items (`/start` message, date-question copy, env vars, DB/schema) — untouched, no task addresses them, consistent with spec.

**2. Placeholder scan:** No TBD/TODO, all code blocks are complete and exact, all commands are exact with expected output. Clean.

**3. Type consistency:** `t()` signature (`t(key: string, vars?: TranslationVariables)`) matches existing usage throughout the file (e.g., `t('onboarding-btn-confirm')` at line 129 takes only a key with no vars, same pattern as the new `t('onboarding-intro-note')` call). `ctx.reply` signature matches existing single-argument calls in the file (e.g., `ctx.reply(t('onboarding-name-enter'))` at line 147). No mismatches.
