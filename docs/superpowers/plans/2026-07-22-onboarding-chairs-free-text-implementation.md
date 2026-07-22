# Onboarding Chairs Free-Text Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users answer the onboarding chairs question by typing a number directly, without first clicking an "Other" button — matching how the departure-location question already works.

**Architecture:** Replace the chairs step's callback-only wait (`waitForCallbackOrExit`) with a loop using the existing `waitOrExit` helper, which accepts either a button callback or free text per iteration. Drop the now-unnecessary "Other" button and its dedicated "enter a number" prompt.

**Tech Stack:** TypeScript, grammY (`InlineKeyboard`, conversations plugin), Jest with `jest.unstable_mockModule` + dynamic `await import`, Fluent (`.ftl`) i18n.

## Global Constraints

- Validation rule for chairs count is unchanged: must be a valid whole number ≥ 0 (`Number.isInteger(parsedChairs) && parsedChairs >= 0`), copied verbatim from the existing code.
- No new env vars, no DB/schema changes, no other onboarding steps touched (spec: "Out of Scope").
- Buttons `0`/`1`/`2`/`3` remain on the chairs keyboard; only the "Other" button is removed (spec: "Decision").
- `onboarding-chairs-question` and `onboarding-chairs-invalid` FTL keys and their wording are unchanged (spec: "Changes").

---

### Task 1: Chairs step accepts free text directly

**Files:**
- Modify: `src/conversations/onboardingConversation.ts:323-374`
- Modify: `src/locales/en.ftl:110-116`
- Modify: `src/locales/pt.ftl:110-116`
- Test: `src/__tests__/conversations/onboardingConversation.test.ts:670-786`

**Interfaces:**
- Consumes: existing `waitOrExit(conversation, ctx, t)` helper (already defined at `src/conversations/onboardingConversation.ts:66-80`), returning `Promise<BotContext | null>`.
- Produces: no new exports; `data.numeroCadeiras: string` is still set on the same `OnboardingData` object exactly as before.

- [ ] **Step 1: Write the failing test changes**

In `src/__tests__/conversations/onboardingConversation.test.ts`, replace the test starting at line 670 (`'should prompt for a custom count when Other is selected and accept a valid number'`) with:

```ts
    it('should accept a typed chair count directly without clicking a button', async () => {
      (googleSheets.addOnboardingData as jest.Mock).mockResolvedValue(undefined);
      process.env.ADMIN_IDS = '[999]';

      const mockConversation = {
        wait: jest
          .fn()
          .mockResolvedValueOnce({
            callbackQuery: { data: 'name_confirm' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'arrival_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'departure_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'car_no' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          .mockResolvedValueOnce({ message: { text: '5' } })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
      };

      const mockCtx = {
        from: { id: 334, first_name: 'Test' },
        reply: jest.fn(),
        api: { sendMessage: jest.fn() },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      expect(i18nMock.translate).toHaveBeenCalledWith(
        'en',
        'onboarding-summary',
        expect.objectContaining({ chairs: '5' }),
      );
    });

    it('should reject invalid typed chair counts and retry until a valid one is given', async () => {
      (googleSheets.addOnboardingData as jest.Mock).mockResolvedValue(undefined);
      process.env.ADMIN_IDS = '[999]';

      const mockConversation = {
        wait: jest
          .fn()
          .mockResolvedValueOnce({
            callbackQuery: { data: 'name_confirm' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'arrival_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'departure_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'car_no' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          .mockResolvedValueOnce({ message: { text: 'abc' } })
          .mockResolvedValueOnce({ message: { text: '-1' } })
          .mockResolvedValueOnce({ message: { text: '1.5' } })
          .mockResolvedValueOnce({ message: { text: '4' } })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
      };

      const mockCtx = {
        from: { id: 335, first_name: 'Test' },
        reply: jest.fn(),
        api: { sendMessage: jest.fn() },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      const invalidCalls = mockCtx.reply.mock.calls.filter(
        ([msg]) => msg === 'onboarding-chairs-invalid',
      );

      expect(invalidCalls).toHaveLength(3);
      expect(i18nMock.translate).toHaveBeenCalledWith(
        'en',
        'onboarding-summary',
        expect.objectContaining({ chairs: '4' }),
      );
    });
```

Leave the other two chairs-related tests in this `describe` block unchanged: `'should collect chair count from a quick-reply button and include it in the summary'` (button path, still uses `chairs_2`) and `'should exit when the user cancels during the chairs step'` (cancel path).

- [ ] **Step 2: Run tests to verify they fail**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/conversations/onboardingConversation.test.ts -t "chair"`
Expected: FAIL — the renamed/updated tests fail because the current implementation still requires a `chairs_other` click before accepting typed text (the first typed message, `'5'` or `'abc'`, is silently ignored by `waitForCallbackOrExit` since it only resolves on a matching callback).

- [ ] **Step 3: Write the minimal implementation**

In `src/conversations/onboardingConversation.ts`, replace lines 323-374 (the entire "Step 6: Chairs question" block) with:

```ts
  // Step 6: Chairs question
  const chairsKeyboard = new InlineKeyboard()
    .text('0', 'chairs_0')
    .text('1', 'chairs_1')
    .text('2', 'chairs_2')
    .text('3', 'chairs_3');

  await ctx.reply(t('onboarding-chairs-question'), { reply_markup: chairsKeyboard });

  let numeroCadeiras: string | null = null;

  while (numeroCadeiras === null) {
    const chairsResponse = await waitOrExit(conversation, ctx, t);

    if (!chairsResponse) return;

    if (chairsResponse.callbackQuery?.data?.startsWith('chairs_')) {
      await chairsResponse.answerCallbackQuery();
      numeroCadeiras = chairsResponse.callbackQuery.data.replace('chairs_', '');
    } else {
      const chairsText = chairsResponse.message?.text ?? '';
      const parsedChairs = Number(chairsText);

      if (
        !chairsText ||
        isNaN(parsedChairs) ||
        !Number.isInteger(parsedChairs) ||
        parsedChairs < 0
      ) {
        await ctx.reply(t('onboarding-chairs-invalid'));
      } else {
        numeroCadeiras = String(parsedChairs);
      }
    }
  }

  data.numeroCadeiras = numeroCadeiras;

  loggers.userChat(ctx.from?.id || 0, 'Onboarding: chairs collected', {
    numeroCadeiras: data.numeroCadeiras,
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/conversations/onboardingConversation.test.ts`
Expected: PASS — all tests in the file passing, including the two updated chair tests, the unchanged button-path test, and the unchanged cancel test.

- [ ] **Step 5: Remove unused FTL keys**

In `src/locales/en.ftl`, remove lines 112-115 (the `onboarding-btn-chairs-other` and `onboarding-chairs-enter` keys and their blank-line separators), so the block around line 110 reads:

```
onboarding-chairs-question = How many chairs will you bring?

onboarding-chairs-invalid = Please provide a valid whole number (0 or more) for the number of chairs.
```

In `src/locales/pt.ftl`, remove lines 112-115 (the same two keys), so the block around line 110 reads:

```
onboarding-chairs-question = Quantas cadeiras vais levar?

onboarding-chairs-invalid = Fornece um número inteiro válido (0 ou mais) para o número de cadeiras.
```

- [ ] **Step 6: Run the full test suite to confirm no regressions**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest`
Expected: PASS — all suites green (no other file references `onboarding-btn-chairs-other` or `onboarding-chairs-enter`, confirmed by the spec's research; removing them cannot break other tests).

- [ ] **Step 7: Commit**

```bash
git add src/conversations/onboardingConversation.ts src/__tests__/conversations/onboardingConversation.test.ts src/locales/en.ftl src/locales/pt.ftl
git commit -m "fix: accept typed chair count directly without requiring an Other button click"
```

---

## Self-Review

**Spec coverage:**
- Chairs keyboard drops "Other" button, keeps 0/1/2/3 → Task 1, Step 3.
- Free text accepted directly via `waitOrExit`, same validation/retry loop preserved → Task 1, Step 3.
- Intermediate "enter a number" prompt removed → Task 1, Step 3 (no `onboarding-chairs-enter` call remains) + Step 5 (FTL key removed).
- `onboarding-btn-chairs-other` and `onboarding-chairs-enter` FTL keys removed in both locales, `onboarding-chairs-question`/`onboarding-chairs-invalid` unchanged → Task 1, Step 5.
- Test updates for the two "Other"-path tests, button-path and cancel tests left unchanged → Task 1, Steps 1 and 2.
- Out of Scope (departure-location untouched, no env/DB changes, no other steps touched) — no task touches these, consistent with spec.

**Placeholder scan:** No TBD/TODO markers; every step has complete, runnable code and exact file paths/line numbers.

**Type consistency:** `numeroCadeiras: string | null` is declared and narrowed to `string` before assignment to `data.numeroCadeiras: string` (matching the `OnboardingData` interface's existing field type at `src/conversations/onboardingConversation.ts:22`). `waitOrExit`'s signature (`Promise<BotContext | null>`) matches its existing definition and existing call sites (e.g. the departure-location step) exactly — no new helper introduced.
