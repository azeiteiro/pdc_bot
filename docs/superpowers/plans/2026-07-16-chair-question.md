# Chair Count Onboarding Question Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chair-count question to the onboarding conversation (buttons for 0/1/2/3 plus a free-text "Other" option), make the departure-location question unconditional, and write the chair count to the correct "Cadeiras" column in the Google Sheet.

**Architecture:** Three sequential changes to `src/conversations/onboardingConversation.ts`: (1) remove the `if (hasCar)` gate around the departure-location step so it always runs, (2) insert a new chairs step between departure location and additional info that collects `data.numeroCadeiras` and shows it in the summary, (3) wire `numeroCadeiras` through to `src/googleApi/googleSheetsApi.ts`'s `OnboardingData` interface and correct the sheet's column order/range. New locale keys are added to `src/locales/en.ftl` / `src/locales/pt.ftl` for the chairs question, its "Other" button, and validation retry message.

**Tech Stack:** TypeScript, grammY + `@grammyjs/conversations`, `@grammyjs/i18n` (Fluent `.ftl` files), Jest with `jest.unstable_mockModule` (ESM mocking), `@googleapis/sheets`.

## Global Constraints

- Departure location must always be asked, regardless of the car answer (remove the existing `if (hasCar) { ... } else { data.localPartida = ''; }` gate).
- Chairs question offers four buttons (`0`, `1`, `2`, `3`, literal numeric labels — no locale key, matching the existing Lisboa/Porto/Coimbra button pattern) plus one "Other" button that prompts for free-text input.
- Any whole number ≥ 0 is a valid custom chair count. Invalid input (non-numeric, negative, or non-integer) shows a validation error and re-prompts, matching the retry pattern used for expense amount validation in `addExpenseConversation.ts`.
- Chair count is shown in the summary/confirmation message.
- Chair count is written to the Google Sheet in the real column order: `Nome | Data chegada | Data de partida | Leva carro? | Local partida | Cadeiras | Tenda entregue | Observações | Telegram User ID`. The "Tenda entregue" column keeps its hardcoded `'Não'` value, just in the correct position. The sheet append range widens from `A:H` to `A:I`. This is a going-forward change only — historical rows are out of scope.
- Chair count is not persisted to SQLite (sheet-only, matching how car ownership, departure location, and additional info are already handled).
- New locale keys follow the existing `onboarding-<topic>` / `onboarding-btn-<action>` naming convention.
- All behavior changes are implemented test-first (RED → GREEN → REFACTOR). Use `pnpm test -- <path>` to run a single test file, `pnpm test` to run the whole suite.

---

### Task 1: Make departure location question unconditional

**Files:**
- Modify: `src/conversations/onboardingConversation.ts` (Step 5 block, currently lines 293-322)
- Test: `src/__tests__/conversations/onboardingConversation.test.ts`

**Interfaces:**
- Consumes: existing `waitOrExit(conversation, ctx, t)` helper (unchanged), the `hasCar` boolean already computed in Step 4 (unchanged, still used for `data.levaCarro`).
- Produces: `data.localPartida` is now always populated from the location step's result (button or free text), never short-circuited to `''` purely because `hasCar === false`. No new exported symbols.

- [ ] **Step 1: Write the failing test**

Add this test inside the `describe('onboardingConversation flow', ...)` block in `src/__tests__/conversations/onboardingConversation.test.ts`, right after the `'should complete full onboarding flow with confirmation'` test:

```ts
    it('should ask departure location even when user has no car', async () => {
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
        from: { id: 222, first_name: 'Test' },
        reply: jest.fn(),
        api: { sendMessage: jest.fn() },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      expect(googleSheets.addOnboardingData).toHaveBeenCalledWith(
        expect.objectContaining({ localPartida: 'Porto' }),
      );
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/__tests__/conversations/onboardingConversation.test.ts`

Expected: FAIL on `should ask departure location even when user has no car` — `addOnboardingData` was called with `localPartida: ''`, not `'Porto'` (the current code skips the location wait when `hasCar` is false, so the `'Porto'` mock response is consumed by the additional-info step instead).

- [ ] **Step 3: Remove the car-conditional gate around departure location**

In `src/conversations/onboardingConversation.ts`, replace the entire Step 5 block:

```ts
  // Step 5: Departure location (conditional on car)
  if (hasCar) {
    const locationKeyboard = new InlineKeyboard()
      .text('Lisboa', 'location_lisboa')
      .text('Porto', 'location_porto')
      .text('Coimbra', 'location_coimbra');

    await ctx.reply(t('onboarding-departure-location'), { reply_markup: locationKeyboard });

    const locationResponse = await waitOrExit(conversation, ctx, t);

    if (!locationResponse) return;

    if (locationResponse.callbackQuery?.data?.startsWith('location_')) {
      await locationResponse.answerCallbackQuery();
      const city = locationResponse.callbackQuery.data.replace('location_', '');

      data.localPartida = city.charAt(0).toUpperCase() + city.slice(1);
    } else if (locationResponse.message?.text) {
      data.localPartida = locationResponse.message.text;
    } else {
      data.localPartida = '';
    }

    loggers.userChat(ctx.from?.id || 0, 'Onboarding: departure location collected', {
      localPartida: data.localPartida,
    });
  } else {
    data.localPartida = '';
  }
```

with:

```ts
  // Step 5: Departure location (always asked)
  const locationKeyboard = new InlineKeyboard()
    .text('Lisboa', 'location_lisboa')
    .text('Porto', 'location_porto')
    .text('Coimbra', 'location_coimbra');

  await ctx.reply(t('onboarding-departure-location'), { reply_markup: locationKeyboard });

  const locationResponse = await waitOrExit(conversation, ctx, t);

  if (!locationResponse) return;

  if (locationResponse.callbackQuery?.data?.startsWith('location_')) {
    await locationResponse.answerCallbackQuery();
    const city = locationResponse.callbackQuery.data.replace('location_', '');

    data.localPartida = city.charAt(0).toUpperCase() + city.slice(1);
  } else if (locationResponse.message?.text) {
    data.localPartida = locationResponse.message.text;
  } else {
    data.localPartida = '';
  }

  loggers.userChat(ctx.from?.id || 0, 'Onboarding: departure location collected', {
    localPartida: data.localPartida,
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/__tests__/conversations/onboardingConversation.test.ts`

Expected: `should ask departure location even when user has no car` PASSES. Several other tests in this file now FAIL (their mocked `car_no` sequences no longer align — the location step now consumes a `wait()` call they didn't account for). This is expected; fixed in the next step.

- [ ] **Step 5: Update the existing tests broken by the unconditional location step**

Replace the `'should handle custom name entry'` test with:

```ts
    it('should handle custom name entry', async () => {
      (googleSheets.addOnboardingData as jest.Mock).mockResolvedValue(undefined);
      process.env.ADMIN_IDS = '[999]';

      const mockConversation = {
        wait: jest
          .fn()
          // 1. Name: choose to edit
          .mockResolvedValueOnce({
            callbackQuery: { data: 'name_edit' },
            answerCallbackQuery: jest.fn(),
          })
          // 2. Custom name text
          .mockResolvedValueOnce({ message: { text: 'Custom Name' } })
          // 3. Arrival unknown
          .mockResolvedValueOnce({
            callbackQuery: { data: 'arrival_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          // 4. Departure unknown
          .mockResolvedValueOnce({
            callbackQuery: { data: 'departure_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          // 5. Car no
          .mockResolvedValueOnce({
            callbackQuery: { data: 'car_no' },
            answerCallbackQuery: jest.fn(),
          })
          // 6. Departure location (now always asked)
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          // 7. Skip additional info
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          // 8. Summary submit
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
      };

      const mockCtx = {
        from: { id: 456, first_name: 'Jane', username: 'janedoe' },
        reply: jest.fn(),
        api: {
          sendMessage: jest.fn(),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      expect(googleSheets.addOnboardingData).toHaveBeenCalledWith({
        nome: 'Custom Name',
        dataChegada: 'onboarding-dont-know',
        dataPartida: 'onboarding-dont-know',
        levaCarro: 'onboarding-no',
        localPartida: 'Porto',
        observacoes: '',
        userId: 456,
      });
    });
```

Replace the `'should handle cancellation at summary'` test with:

```ts
    it('should handle cancellation at summary', async () => {
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
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_cancel' },
            answerCallbackQuery: jest.fn(),
          }),
      };

      const mockCtx = {
        from: { id: 789 },
        reply: jest.fn(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      expect(userRepository.deleteUser).toHaveBeenCalledWith(mockDb, 789);
      expect(mockCtx.reply).toHaveBeenCalledWith('onboarding-cancelled');
      expect(googleSheets.addOnboardingData).not.toHaveBeenCalled();
    });
```

Replace the `'should handle Google Sheets save failure'` test with:

```ts
    it('should handle Google Sheets save failure', async () => {
      (googleSheets.addOnboardingData as jest.Mock).mockRejectedValue(new Error('API error'));
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
        from: { id: 999, first_name: 'Test' },
        reply: jest.fn(),
        api: {
          sendMessage: jest.fn(),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      expect(mockCtx.reply).toHaveBeenCalledWith('onboarding-error-save-failed');
      expect(userRepository.updateUserStatus).not.toHaveBeenCalled();
    });
```

Replace the `'should handle invalid date input and retry'` test with:

```ts
    it('should handle invalid date input and retry', async () => {
      (googleSheets.addOnboardingData as jest.Mock).mockResolvedValue(undefined);
      process.env.ADMIN_IDS = '[999]';

      const mockConversation = {
        wait: jest
          .fn()
          // 1. Name confirm
          .mockResolvedValueOnce({
            callbackQuery: { data: 'name_confirm' },
            answerCallbackQuery: jest.fn(),
          })
          // 2. Arrival: invalid text
          .mockResolvedValueOnce({ message: { text: 'invalid' } })
          // 3. Arrival retry: valid date
          .mockResolvedValueOnce({ message: { text: 'tomorrow' } })
          // 4. Date confirm dialog: reject
          .mockResolvedValueOnce({
            callbackQuery: { data: 'date_reject' },
            answerCallbackQuery: jest.fn(),
          })
          // 5. Arrival retry again: valid date
          .mockResolvedValueOnce({ message: { text: 'tomorrow' } })
          // 6. Date confirm dialog: accept
          .mockResolvedValueOnce({
            callbackQuery: { data: 'date_confirm' },
            answerCallbackQuery: jest.fn(),
          })
          // 7. Departure unknown
          .mockResolvedValueOnce({
            callbackQuery: { data: 'departure_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          // 8. Car no
          .mockResolvedValueOnce({
            callbackQuery: { data: 'car_no' },
            answerCallbackQuery: jest.fn(),
          })
          // 9. Departure location (now always asked)
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          // 10. Skip info
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          // 11. Summary submit
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
      };

      const mockCtx = {
        from: { id: 111, first_name: 'Test' },
        reply: jest.fn(),
        api: {
          sendMessage: jest.fn(),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      expect(mockCtx.reply).toHaveBeenCalledWith('onboarding-date-invalid');
      expect(googleSheets.addOnboardingData).toHaveBeenCalled();
    });
```

- [ ] **Step 6: Run the full test file to confirm all tests pass**

Run: `pnpm test -- src/__tests__/conversations/onboardingConversation.test.ts`

Expected: PASS — all tests in the file green, no failures.

- [ ] **Step 7: Commit**

```bash
git add src/conversations/onboardingConversation.ts src/__tests__/conversations/onboardingConversation.test.ts
git commit -m "feat: always ask departure location during onboarding"
```

---

### Task 2: Add chair-count question step to onboarding conversation

**Files:**
- Modify: `src/conversations/onboardingConversation.ts` (add `numeroCadeiras` field, new step between departure location and additional info, summary interpolation)
- Modify: `src/locales/en.ftl`
- Modify: `src/locales/pt.ftl`
- Test: `src/__tests__/conversations/onboardingConversation.test.ts`

**Interfaces:**
- Consumes: `waitForCallbackOrExit(conversation, ctx, t, callbacks: string[])` and `waitOrExit(conversation, ctx, t)` helpers (unchanged, defined earlier in the same file).
- Produces: local `OnboardingData.numeroCadeiras: string` — a string containing a non-negative integer (e.g. `'0'`, `'1'`, `'4'`). Task 3 consumes this field to build the Google Sheets payload.

- [ ] **Step 1: Add locale keys for the chairs question**

In `src/locales/en.ftl`, insert this block right after the `onboarding-departure-location` key (after line 108) and before the `onboarding-additional-info` key:

```ftl
onboarding-chairs-question = How many chairs will you bring?

onboarding-btn-chairs-other = 🪑 Other

onboarding-chairs-enter = Please enter the number of chairs you'll bring:

onboarding-chairs-invalid = Please provide a valid whole number (0 or more) for the number of chairs.

```

In `src/locales/pt.ftl`, insert this block right after the `onboarding-departure-location` key (after line 108) and before the `onboarding-additional-info` key:

```ftl
onboarding-chairs-question = Quantas cadeiras vais levar?

onboarding-btn-chairs-other = 🪑 Outra

onboarding-chairs-enter = Indica o número de cadeiras que vais levar:

onboarding-chairs-invalid = Fornece um número inteiro válido (0 ou mais) para o número de cadeiras.

```

- [ ] **Step 2: Update the summary message to include the chair count**

In `src/locales/en.ftl`, replace the `onboarding-summary` key:

```ftl
onboarding-summary = Please review your information:

    Name: {$name}
    Arrival: {$arrival}
    Departure: {$departure}
    Car: {$car}
    {$departureLocation ->
      [empty] {""}
      *[other] Departing from: {$departureLocation}

    }
    {$additionalInfo ->
      [empty] {""}
      *[other] Additional info: {$additionalInfo}

    }
    Is this correct?
```

with:

```ftl
onboarding-summary = Please review your information:

    Name: {$name}
    Arrival: {$arrival}
    Departure: {$departure}
    Car: {$car}
    {$departureLocation ->
      [empty] {""}
      *[other] Departing from: {$departureLocation}

    }
    Chairs: {$chairs}
    {$additionalInfo ->
      [empty] {""}
      *[other] Additional info: {$additionalInfo}

    }
    Is this correct?
```

In `src/locales/pt.ftl`, replace the `onboarding-summary` key:

```ftl
onboarding-summary = Por favor confirma a tua informação:

    Nome: {$name}
    Chegada: {$arrival}
    Partida: {$departure}
    Carro: {$car}
    {$departureLocation ->
      [empty] {""}
      *[other] Partida de: {$departureLocation}

    }
    {$additionalInfo ->
      [empty] {""}
      *[other] Info adicional: {$additionalInfo}

    }
    Está tudo correcto?
```

with:

```ftl
onboarding-summary = Por favor confirma a tua informação:

    Nome: {$name}
    Chegada: {$arrival}
    Partida: {$departure}
    Carro: {$car}
    {$departureLocation ->
      [empty] {""}
      *[other] Partida de: {$departureLocation}

    }
    Cadeiras: {$chairs}
    {$additionalInfo ->
      [empty] {""}
      *[other] Info adicional: {$additionalInfo}

    }
    Está tudo correcto?
```

- [ ] **Step 3: Add a test import for the mocked i18n translate function**

In `src/__tests__/conversations/onboardingConversation.test.ts`, add this line right after the existing `const userRepository = await import('../../storage/userRepository.js');` line (so the test can assert on `t()`/`i18n.translate()` call arguments):

```ts
const { i18n: i18nMock } = await import('../../config/i18n.js');
```

- [ ] **Step 4: Write the failing tests for the chairs step**

Add these four tests inside the `describe('onboardingConversation flow', ...)` block, after the `'should handle invalid date input and retry'` test:

```ts
    it('should collect chair count from a quick-reply button and include it in the summary', async () => {
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
          .mockResolvedValueOnce({
            callbackQuery: { data: 'chairs_2' },
            answerCallbackQuery: jest.fn(),
          })
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
        from: { id: 333, first_name: 'Test' },
        reply: jest.fn(),
        api: { sendMessage: jest.fn() },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      expect(i18nMock.translate).toHaveBeenCalledWith(
        'en',
        'onboarding-summary',
        expect.objectContaining({ chairs: '2' }),
      );
    });

    it('should prompt for a custom count when Other is selected and accept a valid number', async () => {
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
          .mockResolvedValueOnce({
            callbackQuery: { data: 'chairs_other' },
            answerCallbackQuery: jest.fn(),
          })
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

    it('should reject invalid custom chair counts and retry until a valid one is given', async () => {
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
          .mockResolvedValueOnce({
            callbackQuery: { data: 'chairs_other' },
            answerCallbackQuery: jest.fn(),
          })
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

    it('should exit when the user cancels during the chairs step', async () => {
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
          .mockResolvedValueOnce({ message: { text: '/cancel' } }),
      };

      const mockCtx = {
        from: { id: 336 },
        reply: jest.fn(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      expect(mockCtx.reply).toHaveBeenCalledWith('onboarding-cancelled');
      expect(googleSheets.addOnboardingData).not.toHaveBeenCalled();
    });
```

- [ ] **Step 5: Run tests to verify the new ones fail**

Run: `pnpm test -- src/__tests__/conversations/onboardingConversation.test.ts`

Expected: FAIL on all four new tests — the `chairs_2` / `chairs_other` callback data isn't recognized by any step yet, so the mocked `wait()` sequence misaligns (the location-step logic or additional-info step consumes the chairs-step mocks instead), and `i18nMock.translate` is never called with an `onboarding-summary` invocation containing a `chairs` key.

- [ ] **Step 6: Add `numeroCadeiras` to the local `OnboardingData` interface**

In `src/conversations/onboardingConversation.ts`, replace:

```ts
interface OnboardingData {
  nome: string;
  dataChegada: string;
  dataPartida: string;
  levaCarro: string;
  localPartida: string;
  observacoes: string;
}
```

with:

```ts
interface OnboardingData {
  nome: string;
  dataChegada: string;
  dataPartida: string;
  levaCarro: string;
  localPartida: string;
  numeroCadeiras: string;
  observacoes: string;
}
```

And update the initial `data` object, replacing:

```ts
  const data: OnboardingData = {
    nome: '',
    dataChegada: '',
    dataPartida: '',
    levaCarro: '',
    localPartida: '',
    observacoes: '',
  };
```

with:

```ts
  const data: OnboardingData = {
    nome: '',
    dataChegada: '',
    dataPartida: '',
    levaCarro: '',
    localPartida: '',
    numeroCadeiras: '',
    observacoes: '',
  };
```

- [ ] **Step 7: Insert the chairs step between departure location and additional info**

In `src/conversations/onboardingConversation.ts`, insert this new block immediately after the departure location step's closing `loggers.userChat(...)` call (the one logging `'Onboarding: departure location collected'`) and before the `// Step 6: Additional information` comment:

```ts
  // Step 6: Chairs question
  const chairsKeyboard = new InlineKeyboard()
    .text('0', 'chairs_0')
    .text('1', 'chairs_1')
    .text('2', 'chairs_2')
    .text('3', 'chairs_3')
    .text(t('onboarding-btn-chairs-other'), 'chairs_other');

  await ctx.reply(t('onboarding-chairs-question'), { reply_markup: chairsKeyboard });

  const chairsResponse = await waitForCallbackOrExit(conversation, ctx, t, [
    'chairs_0',
    'chairs_1',
    'chairs_2',
    'chairs_3',
    'chairs_other',
  ]);

  if (!chairsResponse) return;

  if (chairsResponse.callbackQuery?.data === 'chairs_other') {
    await ctx.reply(t('onboarding-chairs-enter'));

    let chairsSet = false;

    while (!chairsSet) {
      const chairsInput = await waitOrExit(conversation, ctx, t);

      if (!chairsInput) return;

      const chairsText = chairsInput.message?.text ?? '';
      const parsedChairs = Number(chairsText);

      if (!chairsText || isNaN(parsedChairs) || !Number.isInteger(parsedChairs) || parsedChairs < 0) {
        await ctx.reply(t('onboarding-chairs-invalid'));
      } else {
        data.numeroCadeiras = String(parsedChairs);
        chairsSet = true;
      }
    }
  } else {
    data.numeroCadeiras = chairsResponse.callbackQuery!.data!.replace('chairs_', '');
  }

  loggers.userChat(ctx.from?.id || 0, 'Onboarding: chairs collected', {
    numeroCadeiras: data.numeroCadeiras,
  });

```

Renumber the following two comments so the step order stays readable. Replace:

```ts
  // Step 6: Additional information
```

with:

```ts
  // Step 7: Additional information
```

And replace:

```ts
  // Step 7: Summary and confirmation
```

with:

```ts
  // Step 8: Summary and confirmation
```

- [ ] **Step 8: Add `chairs` to the summary interpolation**

In `src/conversations/onboardingConversation.ts`, replace:

```ts
  const summaryMessage = t('onboarding-summary', {
    name: data.nome,
    arrival: data.dataChegada,
    departure: data.dataPartida,
    car: data.levaCarro,
    departureLocation: data.localPartida || 'empty',
    additionalInfo: data.observacoes || 'empty',
  });
```

with:

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

- [ ] **Step 9: Insert a chairs-step mock into the pre-existing flow tests**

These tests were written before the chairs step existed; each now needs a `chairs_0` mock inserted right after its departure-location mock (before the `info_skip` / additional-info mock), otherwise the `chairs_0` mock consumed by the real chairs step will misalign every mock after it.

In the `'should complete full onboarding flow with confirmation'` test, replace:

```ts
          // 7. Departure location
          .mockResolvedValueOnce({ message: { text: 'Lisbon' } })
          // 8. Additional info
          .mockResolvedValueOnce({ message: { text: 'Test notes' } })
          // 9. Summary confirmation
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
```

with:

```ts
          // 7. Departure location
          .mockResolvedValueOnce({ message: { text: 'Lisbon' } })
          // 8. Chairs
          .mockResolvedValueOnce({
            callbackQuery: { data: 'chairs_0' },
            answerCallbackQuery: jest.fn(),
          })
          // 9. Additional info
          .mockResolvedValueOnce({ message: { text: 'Test notes' } })
          // 10. Summary confirmation
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
```

In the `'should handle custom name entry'` test (as it stands after Task 1), replace:

```ts
          // 6. Departure location (now always asked)
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          // 7. Skip additional info
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          // 8. Summary submit
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
```

with:

```ts
          // 6. Departure location (now always asked)
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          // 7. Chairs
          .mockResolvedValueOnce({
            callbackQuery: { data: 'chairs_0' },
            answerCallbackQuery: jest.fn(),
          })
          // 8. Skip additional info
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          // 9. Summary submit
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
```

In the `'should handle cancellation at summary'` test, replace:

```ts
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_cancel' },
            answerCallbackQuery: jest.fn(),
          }),
```

with:

```ts
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'chairs_0' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_cancel' },
            answerCallbackQuery: jest.fn(),
          }),
```

In the `'should handle Google Sheets save failure'` test, replace:

```ts
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
```

with:

```ts
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'chairs_0' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
```

In the `'should handle invalid date input and retry'` test, replace:

```ts
          // 9. Departure location (now always asked)
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          // 10. Skip info
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          // 11. Summary submit
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
```

with:

```ts
          // 9. Departure location (now always asked)
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          // 10. Chairs
          .mockResolvedValueOnce({
            callbackQuery: { data: 'chairs_0' },
            answerCallbackQuery: jest.fn(),
          })
          // 11. Skip info
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          // 12. Summary submit
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
```

In the `'should ask departure location even when user has no car'` test (added in Task 1), replace:

```ts
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
```

with:

```ts
          .mockResolvedValueOnce({ message: { text: 'Porto' } })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'chairs_0' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'summary_submit' },
            answerCallbackQuery: jest.fn(),
          }),
```

- [ ] **Step 10: Run the full test file to confirm all tests pass**

Run: `pnpm test -- src/__tests__/conversations/onboardingConversation.test.ts`

Expected: PASS — all tests in the file green, no failures.

- [ ] **Step 11: Commit**

```bash
git add src/conversations/onboardingConversation.ts src/locales/en.ftl src/locales/pt.ftl src/__tests__/conversations/onboardingConversation.test.ts
git commit -m "feat: add chair-count question to onboarding conversation"
```

---

### Task 3: Wire chair count through to Google Sheets with corrected column order

**Files:**
- Modify: `src/googleApi/googleSheetsApi.ts`
- Modify: `src/conversations/onboardingConversation.ts` (sheetData construction only)
- Test: `src/__tests__/googleApi/googleSheetsApi.test.ts`
- Test: `src/__tests__/conversations/onboardingConversation.test.ts`

**Interfaces:**
- Consumes: `data.numeroCadeiras` from Task 2's local `OnboardingData` (in `onboardingConversation.ts`).
- Produces: `OnboardingData` (exported from `googleSheetsApi.ts`) gains a required `numeroCadeiras: string` field; `addOnboardingData` writes 9 columns (`A:I`) in the order `nome, dataChegada, dataPartida, levaCarro, localPartida, numeroCadeiras, 'Não', observacoes, String(userId)`.

- [ ] **Step 1: Write the failing test for the corrected column order**

Replace the `describe('addOnboardingData', ...)` block in `src/__tests__/googleApi/googleSheetsApi.test.ts`:

```ts
  describe('addOnboardingData', () => {
    it('should append a row with the correct column order and range', async () => {
      const mockResponse = { data: { updates: { updatedCells: 9 } } };

      mockAppend.mockResolvedValueOnce(mockResponse as never);

      const data = {
        nome: 'João Silva',
        dataChegada: '15/05/2026',
        dataPartida: '20/05/2026',
        levaCarro: 'Sim',
        localPartida: 'Lisboa',
        numeroCadeiras: '2',
        observacoes: 'Vegetarian',
        userId: 12345,
      };

      await addOnboardingData(data);

      expect(mockAppend).toHaveBeenCalledWith({
        spreadsheetId: 'test-onboarding-spreadsheet-id',
        range: 'test_sheet_id!A:I',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              'João Silva',
              '15/05/2026',
              '20/05/2026',
              'Sim',
              'Lisboa',
              '2',
              'Não',
              'Vegetarian',
              '12345',
            ],
          ],
        },
      });
    });

    it('should handle empty optional fields', async () => {
      const mockResponse = { data: { updates: { updatedCells: 9 } } };

      mockAppend.mockResolvedValueOnce(mockResponse as never);

      const data = {
        nome: 'Maria Santos',
        dataChegada: 'Não sei',
        dataPartida: 'Não sei',
        levaCarro: 'Não',
        localPartida: '',
        numeroCadeiras: '0',
        observacoes: '',
        userId: 67890,
      };

      await expect(addOnboardingData(data)).resolves.not.toThrow();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/__tests__/googleApi/googleSheetsApi.test.ts`

Expected: FAIL on `should append a row with the correct column order and range` — the current code writes `range: 'test_sheet_id!A:H'` and a `values` array of 8 elements (`'Não'` in the 6th position, no `numeroCadeiras`), not matching the expected 9-element array with `range: 'test_sheet_id!A:I'`.

- [ ] **Step 3: Update the `OnboardingData` interface and `addOnboardingData` column order**

In `src/googleApi/googleSheetsApi.ts`, replace:

```ts
export interface OnboardingData {
  nome: string;
  dataChegada: string;
  dataPartida: string;
  levaCarro: string;
  localPartida: string;
  observacoes: string;
  userId: number;
}

/**
 * Add onboarding data to Google Sheets
 */
export async function addOnboardingData(data: OnboardingData): Promise<void> {
  try {
    const sheets = await getSheets();

    const values = [
      [
        data.nome,
        data.dataChegada,
        data.dataPartida,
        data.levaCarro,
        data.localPartida,
        'Não',
        data.observacoes,
        String(data.userId),
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.ONBOARDING_SPREADSHEET_ID,
      range: `${process.env.ONBOARDING_SHEET_ID}!A:H`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    loggers.sheetsOperation('addOnboardingData', true, { data });
  } catch (error) {
    loggers.errorWithContext(error as Error, 'Google Sheets API - addOnboardingData');
    throw error;
  }
}
```

with:

```ts
export interface OnboardingData {
  nome: string;
  dataChegada: string;
  dataPartida: string;
  levaCarro: string;
  localPartida: string;
  numeroCadeiras: string;
  observacoes: string;
  userId: number;
}

/**
 * Add onboarding data to Google Sheets
 */
export async function addOnboardingData(data: OnboardingData): Promise<void> {
  try {
    const sheets = await getSheets();

    const values = [
      [
        data.nome,
        data.dataChegada,
        data.dataPartida,
        data.levaCarro,
        data.localPartida,
        data.numeroCadeiras,
        'Não',
        data.observacoes,
        String(data.userId),
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.ONBOARDING_SPREADSHEET_ID,
      range: `${process.env.ONBOARDING_SHEET_ID}!A:I`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    loggers.sheetsOperation('addOnboardingData', true, { data });
  } catch (error) {
    loggers.errorWithContext(error as Error, 'Google Sheets API - addOnboardingData');
    throw error;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/__tests__/googleApi/googleSheetsApi.test.ts`

Expected: PASS — both `addOnboardingData` tests green.

- [ ] **Step 5: Wire `numeroCadeiras` into the onboarding conversation's sheet payload**

In `src/conversations/onboardingConversation.ts`, replace:

```ts
  const sheetData: GoogleSheetsOnboardingData = {
    nome: data.nome,
    dataChegada: data.dataChegada,
    dataPartida: data.dataPartida,
    levaCarro: data.levaCarro,
    localPartida: data.localPartida,
    observacoes: data.observacoes,
    userId,
  };
```

with:

```ts
  const sheetData: GoogleSheetsOnboardingData = {
    nome: data.nome,
    dataChegada: data.dataChegada,
    dataPartida: data.dataPartida,
    levaCarro: data.levaCarro,
    localPartida: data.localPartida,
    numeroCadeiras: data.numeroCadeiras,
    observacoes: data.observacoes,
    userId,
  };
```

- [ ] **Step 6: Update the two full-shape assertions in the onboarding conversation test**

In `src/__tests__/conversations/onboardingConversation.test.ts`, in the `'should complete full onboarding flow with confirmation'` test, replace:

```ts
      expect(googleSheets.addOnboardingData).toHaveBeenCalledWith({
        nome: 'John Doe',
        dataChegada: expect.any(String),
        dataPartida: expect.any(String),
        levaCarro: 'onboarding-yes',
        localPartida: 'Lisbon',
        observacoes: 'Test notes',
        userId: 123,
      });
```

with:

```ts
      expect(googleSheets.addOnboardingData).toHaveBeenCalledWith({
        nome: 'John Doe',
        dataChegada: expect.any(String),
        dataPartida: expect.any(String),
        levaCarro: 'onboarding-yes',
        localPartida: 'Lisbon',
        numeroCadeiras: '0',
        observacoes: 'Test notes',
        userId: 123,
      });
```

In the `'should handle custom name entry'` test, replace:

```ts
      expect(googleSheets.addOnboardingData).toHaveBeenCalledWith({
        nome: 'Custom Name',
        dataChegada: 'onboarding-dont-know',
        dataPartida: 'onboarding-dont-know',
        levaCarro: 'onboarding-no',
        localPartida: 'Porto',
        observacoes: '',
        userId: 456,
      });
```

with:

```ts
      expect(googleSheets.addOnboardingData).toHaveBeenCalledWith({
        nome: 'Custom Name',
        dataChegada: 'onboarding-dont-know',
        dataPartida: 'onboarding-dont-know',
        levaCarro: 'onboarding-no',
        localPartida: 'Porto',
        numeroCadeiras: '0',
        observacoes: '',
        userId: 456,
      });
```

- [ ] **Step 7: Run the full test suite to confirm everything passes**

Run: `pnpm test`

Expected: PASS — full suite green, no failures, coverage thresholds met.

- [ ] **Step 8: Commit**

```bash
git add src/googleApi/googleSheetsApi.ts src/conversations/onboardingConversation.ts src/__tests__/googleApi/googleSheetsApi.test.ts src/__tests__/conversations/onboardingConversation.test.ts
git commit -m "feat: write chair count to the Google Sheets Cadeiras column"
```
