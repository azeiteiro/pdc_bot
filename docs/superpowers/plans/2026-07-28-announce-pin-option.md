# Announce Pin Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin optionally pin the `/announce` broadcast in the group, choosing whether the pin notifies members, via two new confirm-screen buttons and a short follow-up prompt.

**Architecture:** Two new grammY `bot.callbackQuery` handlers alongside the existing `announce_confirm` / `announce_cancel` in `src/botsCommands/adminCommands.ts`, plus a third preview button. A new optional `pendingPinMessageId` session field carries the sent broadcast's `message_id` between the "send & pin" step and the notify/silent decision, mirroring the existing `pendingBroadcast` field's lifecycle.

**Tech Stack:** grammY (`InlineKeyboard`, `bot.api.sendMessage`, `bot.api.pinChatMessage`), TypeScript (strict mode), Jest with `jest.unstable_mockModule` (ESM mocking).

## Global Constraints

- Every callback handler independently re-verifies `isAdmin(ctx.from.id)` — callback queries are separate updates from the original command, identity must never be inferred from session state alone.
- Use `config.groupChatId` from `src/config/environment.ts` (never `process.env.GROUP_CHAT_ID` directly), consistent with the existing `/announce` handlers.
- Telegram legacy Markdown (`parse_mode: 'Markdown'`), not MarkdownV2/HTML — matches the existing broadcast send.
- A pin failure must never be reported as a broadcast failure — the message is already sent and confirmed to the admin before the pin question even appears.
- Run `npm run lint` and `npm run format:check` clean on every file touched.

---

### Task 1: Send & Pin button and `announce_confirm_pin` handler

**Files:**
- Modify: `src/types/types.ts:118-128` (`SessionData` interface)
- Modify: `src/botsCommands/adminCommands.ts:379-438` (preview keyboard + new callback handler, inserted after the existing `announce_confirm` handler)
- Test: `src/__tests__/botsCommands/adminCommands.test.ts` (mock/helper updates + updated keyboard assertion + new describe block)

**Interfaces:**
- Consumes: `isAdmin` (existing import), `config.groupChatId` (existing import), `loggers.errorWithContext` (existing import), `bot.api.sendMessage(chatId, text, { parse_mode: 'Markdown' })` returning `{ message_id: number }` (grammY's `Message.TextMessage`), `ctx.session.pendingBroadcast` (existing field).
- Produces: `ctx.session.pendingPinMessageId: number | undefined` on `SessionData` — Task 2's `announce_pin_notify` / `announce_pin_silent` handlers read and clear this field. New callback name `announce_confirm_pin`, registered via `bot.callbackQuery('announce_confirm_pin', ...)`.

- [ ] **Step 1: Add the `pendingPinMessageId` field to `SessionData`**

In `src/types/types.ts`, change:

```ts
export interface SessionData {
  expenseData?: {
    title: string;
    name: string;
    amount: number;
    date: string;
    description?: string;
  };
  preferredLanguage?: 'en' | 'pt';
  pendingBroadcast?: string;
}
```

to:

```ts
export interface SessionData {
  expenseData?: {
    title: string;
    name: string;
    amount: number;
    date: string;
    description?: string;
  };
  preferredLanguage?: 'en' | 'pt';
  pendingBroadcast?: string;
  pendingPinMessageId?: number;
}
```

- [ ] **Step 2: Update test mocks/helpers to support the new flow**

In `src/__tests__/botsCommands/adminCommands.test.ts`, the `beforeEach` block currently builds `mockBot.api.sendMessage` with `mockResolvedValue({} as never)`. Change it to resolve with a message id, since the new handler needs `sent.message_id`:

```ts
      api: {
        sendMessage: jest.fn().mockResolvedValue({ message_id: 789 } as never),
      },
```

Then update the `createCallbackCtx` helper (currently typed `session: { pendingBroadcast?: string } = {}`) to also carry the new field:

```ts
  const createCallbackCtx = (
    userId: number,
    session: { pendingBroadcast?: string; pendingPinMessageId?: number } = {},
  ) => ({
    from: { id: userId },
    session,
    match: undefined,
    reply: jest.fn().mockReturnValue(Promise.resolve({ message_id: 456 })),
    answerCallbackQuery: jest.fn().mockResolvedValue({} as never),
    editMessageText: jest.fn().mockResolvedValue({} as never),
  });
```

- [ ] **Step 3: Update the failing keyboard-shape test**

Replace the existing test (around line 718) that asserts a single-row, two-button keyboard:

```ts
    it('should store the message in session and reply with a preview and keyboard', async () => {
      const ctx = createCtx(adminId, '/announce Party tonight at *9pm*!');

      (ctx as unknown as { session: { pendingBroadcast?: string } }).session = {};

      await handlers['announce'](ctx);

      expect(
        (ctx as unknown as { session: { pendingBroadcast?: string } }).session.pendingBroadcast,
      ).toBe('Party tonight at *9pm*!');

      const [message, options] = ctx.reply.mock.calls[0];

      expect(message).toContain('Party tonight at *9pm*!');
      expect(options).toEqual(
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.objectContaining({
            inline_keyboard: [
              [
                expect.objectContaining({ callback_data: 'announce_confirm' }),
                expect.objectContaining({ callback_data: 'announce_confirm_pin' }),
              ],
              [expect.objectContaining({ callback_data: 'announce_cancel' })],
            ],
          }),
        }),
      );
    });
```

- [ ] **Step 4: Add the failing `announce_confirm_pin callback` describe block**

Insert this new `describe` block immediately after the existing `describe('announce_confirm callback', ...)` block (before `describe('announce_cancel callback', ...)`, around line 823):

```ts
    describe('announce_confirm_pin callback', () => {
      it('should reject non-admins', async () => {
        const ctx = createCallbackCtx(999, { pendingBroadcast: 'Hello' });

        await callbackHandlers['announce_confirm_pin'](ctx);
        expect(ctx.answerCallbackQuery).toHaveBeenCalledWith("You're not allowed to do that");
        expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
      });

      it('should be a no-op when there is no pending broadcast', async () => {
        const ctx = createCallbackCtx(adminId, {});

        await callbackHandlers['announce_confirm_pin'](ctx);

        expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Nothing pending'),
        );
      });

      it('should send the pending broadcast, store the sent message id, and ask to pin', async () => {
        const ctx = createCallbackCtx(adminId, { pendingBroadcast: 'Party tonight at *9pm*!' });

        await callbackHandlers['announce_confirm_pin'](ctx);

        expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
          'group-chat-123',
          'Party tonight at *9pm*!',
          { parse_mode: 'Markdown' },
        );
        expect(ctx.session.pendingBroadcast).toBeUndefined();
        expect(ctx.session.pendingPinMessageId).toBe(789);
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Pin this message?'),
          expect.objectContaining({
            reply_markup: expect.objectContaining({
              inline_keyboard: [
                [
                  expect.objectContaining({ callback_data: 'announce_pin_notify' }),
                  expect.objectContaining({ callback_data: 'announce_pin_silent' }),
                ],
              ],
            }),
          }),
        );
      });

      it('should report a failure and clear the pending broadcast if sendMessage rejects', async () => {
        const ctx = createCallbackCtx(adminId, { pendingBroadcast: 'Party tonight!' });

        mockBot.api.sendMessage.mockRejectedValueOnce(new Error('network error') as never);

        await callbackHandlers['announce_confirm_pin'](ctx);

        expect(loggers.errorWithContext).toHaveBeenCalledWith(
          expect.any(Error),
          '/announce group send',
        );
        expect(ctx.session.pendingBroadcast).toBeUndefined();
        expect(ctx.session.pendingPinMessageId).toBeUndefined();
        expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining('Failed to send'));
      });
    });
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npm test -- adminCommands.test.ts`
Expected: FAIL — the keyboard-shape test fails (current implementation has a 1-row, 2-button keyboard), and every `announce_confirm_pin callback` test fails with a `TypeError: callbackHandlers['announce_confirm_pin'] is not a function` (handler not yet registered).

- [ ] **Step 6: Update the preview keyboard in `adminCommands.ts`**

In `src/botsCommands/adminCommands.ts`, change the `announce` command's keyboard (around line 397):

```ts
    const keyboard = new InlineKeyboard()
      .text('✅ Send', 'announce_confirm')
      .text('❌ Cancel', 'announce_cancel');
```

to:

```ts
    const keyboard = new InlineKeyboard()
      .text('✅ Send', 'announce_confirm')
      .text('📌 Send & Pin', 'announce_confirm_pin')
      .row()
      .text('❌ Cancel', 'announce_cancel');
```

- [ ] **Step 7: Add the `announce_confirm_pin` handler**

In `src/botsCommands/adminCommands.ts`, insert this new handler immediately after the existing `bot.callbackQuery('announce_confirm', ...)` handler (after its closing `});`, before `bot.callbackQuery('announce_cancel', ...)`):

```ts
  bot.callbackQuery('announce_confirm_pin', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCallbackQuery("You're not allowed to do that");

      return;
    }

    const pendingBroadcast = ctx.session.pendingBroadcast;

    if (!pendingBroadcast) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('Nothing pending — this broadcast was already sent or cancelled.');

      return;
    }

    let messageId: number;

    try {
      const sent = await bot.api.sendMessage(config.groupChatId, pendingBroadcast, {
        parse_mode: 'Markdown',
      });

      messageId = sent.message_id;
    } catch (error) {
      loggers.errorWithContext(error as Error, '/announce group send');
      ctx.session.pendingBroadcast = undefined;
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('❌ Failed to send the broadcast. Please try /announce again.');

      return;
    }

    ctx.session.pendingBroadcast = undefined;
    ctx.session.pendingPinMessageId = messageId;

    const pinKeyboard = new InlineKeyboard()
      .text('🔔 Notify', 'announce_pin_notify')
      .text('🔕 Silent', 'announce_pin_silent');

    await ctx.answerCallbackQuery();
    await ctx.editMessageText('✅ Sent to the group.\n\nPin this message?', {
      reply_markup: pinKeyboard,
    });
  });
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- adminCommands.test.ts`
Expected: PASS — all tests in the file pass, including the updated keyboard-shape test and the new `announce_confirm_pin callback` block.

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS — all suites green, no regressions in other test files.

- [ ] **Step 10: Commit**

```bash
git add src/types/types.ts src/botsCommands/adminCommands.ts src/__tests__/botsCommands/adminCommands.test.ts
git commit -m "feat: add Send & Pin option to /announce confirm screen"
```

---

### Task 2: `announce_pin_notify` / `announce_pin_silent` handlers

**Files:**
- Modify: `src/botsCommands/adminCommands.ts` (two new callback handlers, inserted after the `announce_confirm_pin` handler added in Task 1)
- Test: `src/__tests__/botsCommands/adminCommands.test.ts` (mock/helper updates + new describe block)

**Interfaces:**
- Consumes: `ctx.session.pendingPinMessageId: number | undefined` (produced by Task 1's `announce_confirm_pin` handler), `isAdmin`, `config.groupChatId`, `loggers.errorWithContext`, `loggers.botResponse` (existing import).
- Produces: nothing consumed by later tasks — this is the terminal step of the pin flow.

- [ ] **Step 1: Add `pinChatMessage` to the mock bot**

In `src/__tests__/botsCommands/adminCommands.test.ts`, the `mockBot` type declaration currently reads:

```ts
  let mockBot: {
    filter: jest.Mock;
    command: jest.Mock;
    callbackQuery: jest.Mock;
    api: { sendMessage: jest.Mock };
  };
```

Change it to:

```ts
  let mockBot: {
    filter: jest.Mock;
    command: jest.Mock;
    callbackQuery: jest.Mock;
    api: { sendMessage: jest.Mock; pinChatMessage: jest.Mock };
  };
```

And in the `beforeEach` block, change:

```ts
      api: {
        sendMessage: jest.fn().mockResolvedValue({ message_id: 789 } as never),
      },
```

to:

```ts
      api: {
        sendMessage: jest.fn().mockResolvedValue({ message_id: 789 } as never),
        pinChatMessage: jest.fn().mockResolvedValue(true as never),
      },
```

- [ ] **Step 2: Add the failing `announce_pin_notify` / `announce_pin_silent` describe block**

Insert this new `describe` block immediately after the `describe('announce_confirm_pin callback', ...)` block added in Task 1 (before `describe('announce_cancel callback', ...)`):

```ts
    describe('announce_pin_notify / announce_pin_silent callbacks', () => {
      it('should reject non-admins on announce_pin_notify', async () => {
        const ctx = createCallbackCtx(999, { pendingPinMessageId: 789 });

        await callbackHandlers['announce_pin_notify'](ctx);
        expect(ctx.answerCallbackQuery).toHaveBeenCalledWith("You're not allowed to do that");
        expect(mockBot.api.pinChatMessage).not.toHaveBeenCalled();
      });

      it('should reject non-admins on announce_pin_silent', async () => {
        const ctx = createCallbackCtx(999, { pendingPinMessageId: 789 });

        await callbackHandlers['announce_pin_silent'](ctx);
        expect(ctx.answerCallbackQuery).toHaveBeenCalledWith("You're not allowed to do that");
        expect(mockBot.api.pinChatMessage).not.toHaveBeenCalled();
      });

      it('should be a no-op when there is no pending pin', async () => {
        const ctx = createCallbackCtx(adminId, {});

        await callbackHandlers['announce_pin_notify'](ctx);

        expect(mockBot.api.pinChatMessage).not.toHaveBeenCalled();
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Nothing pending'),
        );
      });

      it('should pin with a notification and clear the pending pin on announce_pin_notify', async () => {
        const ctx = createCallbackCtx(adminId, { pendingPinMessageId: 789 });

        await callbackHandlers['announce_pin_notify'](ctx);

        expect(mockBot.api.pinChatMessage).toHaveBeenCalledWith('group-chat-123', 789, {
          disable_notification: false,
        });
        expect(ctx.session.pendingPinMessageId).toBeUndefined();
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Sent to the group and pinned'),
        );
      });

      it('should pin silently and clear the pending pin on announce_pin_silent', async () => {
        const ctx = createCallbackCtx(adminId, { pendingPinMessageId: 789 });

        await callbackHandlers['announce_pin_silent'](ctx);

        expect(mockBot.api.pinChatMessage).toHaveBeenCalledWith('group-chat-123', 789, {
          disable_notification: true,
        });
        expect(ctx.session.pendingPinMessageId).toBeUndefined();
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Sent to the group and pinned'),
        );
      });

      it('should report the broadcast as sent but note the pin failure if pinChatMessage rejects', async () => {
        const ctx = createCallbackCtx(adminId, { pendingPinMessageId: 789 });

        mockBot.api.pinChatMessage.mockRejectedValueOnce(new Error('not enough rights') as never);

        await callbackHandlers['announce_pin_notify'](ctx);

        expect(loggers.errorWithContext).toHaveBeenCalledWith(
          expect.any(Error),
          '/announce group pin',
        );
        expect(ctx.session.pendingPinMessageId).toBeUndefined();
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('pin failed'),
        );
      });
    });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- adminCommands.test.ts`
Expected: FAIL — every test in the new describe block fails with `TypeError: callbackHandlers['announce_pin_notify'] is not a function` (or `announce_pin_silent`), since neither handler is registered yet.

- [ ] **Step 4: Add the `announce_pin_notify` / `announce_pin_silent` handlers**

In `src/botsCommands/adminCommands.ts`, insert these two new handlers immediately after the `announce_confirm_pin` handler added in Task 1 (after its closing `});`, before `bot.callbackQuery('announce_cancel', ...)`):

This file registers each callback with its own full handler body (see the
existing `announce_confirm` / `announce_cancel` handlers, which duplicate
the same admin-check pattern rather than sharing a helper) — follow that
established style here too:

```ts
  bot.callbackQuery('announce_pin_notify', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCallbackQuery("You're not allowed to do that");

      return;
    }

    const pendingPinMessageId = ctx.session.pendingPinMessageId;

    if (!pendingPinMessageId) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('Nothing pending — this pin decision was already made.');

      return;
    }

    try {
      await bot.api.pinChatMessage(config.groupChatId, pendingPinMessageId, {
        disable_notification: false,
      });
    } catch (error) {
      loggers.errorWithContext(error as Error, '/announce group pin');
      ctx.session.pendingPinMessageId = undefined;
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('✅ Sent to the group (pin failed — check bot permissions).');

      return;
    }

    ctx.session.pendingPinMessageId = undefined;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('✅ Sent to the group and pinned.');
    loggers.botResponse(ctx.from.id, 'Broadcast pinned');
  });

  bot.callbackQuery('announce_pin_silent', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCallbackQuery("You're not allowed to do that");

      return;
    }

    const pendingPinMessageId = ctx.session.pendingPinMessageId;

    if (!pendingPinMessageId) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('Nothing pending — this pin decision was already made.');

      return;
    }

    try {
      await bot.api.pinChatMessage(config.groupChatId, pendingPinMessageId, {
        disable_notification: true,
      });
    } catch (error) {
      loggers.errorWithContext(error as Error, '/announce group pin');
      ctx.session.pendingPinMessageId = undefined;
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('✅ Sent to the group (pin failed — check bot permissions).');

      return;
    }

    ctx.session.pendingPinMessageId = undefined;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('✅ Sent to the group and pinned.');
    loggers.botResponse(ctx.from.id, 'Broadcast pinned');
  });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- adminCommands.test.ts`
Expected: PASS — all tests in the file pass, including the new `announce_pin_notify / announce_pin_silent callbacks` block.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — all suites green, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/botsCommands/adminCommands.ts src/__tests__/botsCommands/adminCommands.test.ts
git commit -m "feat: add notify/silent pin decision after Send & Pin"
```

---

### Task 3: Full verification

**Files:** none (verification only, no code changes expected)

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All suites pass, no failures.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: Clean on every file touched by this feature (`src/types/types.ts`, `src/botsCommands/adminCommands.ts`, `src/__tests__/botsCommands/adminCommands.test.ts`). Any pre-existing errors in unrelated files (e.g. `crawler.js`) are out of scope — confirm via `git diff <merge-base>..HEAD --stat -- <file>` that this branch didn't touch them before treating any lint error as pre-existing.

- [ ] **Step 3: Run format check**

Run: `npm run format:check`
Expected: Clean — "All matched files use Prettier code style!"

- [ ] **Step 4: Manual smoke test note**

Manually exercising `/announce` → `📌 Send & Pin` → `🔔 Notify`/`🔕 Silent` against the real bot in the group remains a post-deploy step, not automatable here. No code change required for this step — it's a note for the human operator, not a task deliverable.
