# `/announce` Prompt-and-Wait Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change `/announce` from requiring the whole broadcast message inline (`/announce <message>`) to prompting the admin and waiting for their next text message, using a `@grammyjs/conversations` conversation.

**Architecture:** A new, minimal conversation (`announceConversation`) owns exactly one step: prompt, wait for one text message, store it in `ctx.session.pendingBroadcast`, show the existing preview + keyboard. The `/announce` command handler shrinks to an admin check plus `ctx.conversation.enter('announceConversation')`. The five existing callback handlers (`announce_confirm`, `announce_confirm_pin`, `announce_pin_notify`, `announce_pin_silent`, `announce_cancel`) are not touched.

**Tech Stack:** grammY, `@grammyjs/conversations`, TypeScript, Jest (`jest.unstable_mockModule`, ESM).

## Global Constraints

- Non-admin rejection message is exactly `"You're not allowed to do that"`, matching every other admin command.
- No i18n/translation for any new string — admin commands in this codebase are plain English only.
- Escape-command check follows the existing convention from `addExpenseConversation.ts`/`onboardingConversation.ts`: recognizes `/cancel` and the flow's own command name.
- Do not modify `announce_confirm`, `announce_confirm_pin`, `announce_pin_notify`, `announce_pin_silent`, or `announce_cancel` in `src/botsCommands/adminCommands.ts`.
- `/announce` always enters the conversation — any inline text after the command is ignored (no quick-insert shortcut).
- ESLint and Prettier must be clean on every file touched by this plan (`npm run lint`, `npm run format:check`).
- Full test suite (`npm test`) must pass after every task.

---

### Task 1: Create the `announceConversation`

**Files:**
- Create: `src/conversations/announceConversation.ts`
- Test: `src/__tests__/conversations/announceConversation.test.ts`

**Interfaces:**
- Produces: `export async function announceConversation(conversation: BotConversation, ctx: BotContext): Promise<void>` — later tasks (`adminCommands.ts`, `mainBot.ts`) reference the string key `'announceConversation'` only; `mainBot.ts` imports the function itself.
- Consumes: `BotContext`, `BotConversation` from `../types/types.js` (already defined, no changes needed); `InlineKeyboard` from `grammy`.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/conversations/announceConversation.test.ts`:

```ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';

const { announceConversation } = await import('../../conversations/announceConversation.js');

describe('announceConversation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockCtx = () => ({
    reply: jest.fn(),
  });

  const createMockMsgCtx = (text: string) => ({
    message: { text },
    session: {} as { pendingBroadcast?: string },
    reply: jest.fn(),
  });

  it('should prompt for the broadcast message and wait for a text reply', async () => {
    const ctx = createMockCtx();
    const msgCtx = createMockMsgCtx('Hello group');

    const conversation = {
      waitFor: jest.fn().mockResolvedValueOnce(msgCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await announceConversation(conversation as any, ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(
      'Send the message you want to broadcast to the group (or /cancel to abort).',
    );
    expect(conversation.waitFor).toHaveBeenCalledWith('message:text');
  });

  it('should store the message in session and reply with a preview and keyboard', async () => {
    const ctx = createMockCtx();
    const msgCtx = createMockMsgCtx('Party tonight at *9pm*!');

    const conversation = {
      waitFor: jest.fn().mockResolvedValueOnce(msgCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await announceConversation(conversation as any, ctx as any);

    expect(msgCtx.session.pendingBroadcast).toBe('Party tonight at *9pm*!');

    const [message, options] = msgCtx.reply.mock.calls[0];

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

  it('should cancel on /cancel without touching the session', async () => {
    const ctx = createMockCtx();
    const msgCtx = createMockMsgCtx('/cancel');

    const conversation = {
      waitFor: jest.fn().mockResolvedValueOnce(msgCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await announceConversation(conversation as any, ctx as any);

    expect(msgCtx.reply).toHaveBeenCalledWith('Broadcast cancelled.');
    expect(msgCtx.session.pendingBroadcast).toBeUndefined();
  });

  it('should cancel on re-issuing /announce as an escape command', async () => {
    const ctx = createMockCtx();
    const msgCtx = createMockMsgCtx('/announce');

    const conversation = {
      waitFor: jest.fn().mockResolvedValueOnce(msgCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await announceConversation(conversation as any, ctx as any);

    expect(msgCtx.reply).toHaveBeenCalledWith('Broadcast cancelled.');
    expect(msgCtx.session.pendingBroadcast).toBeUndefined();
  });
});
```

Note: this test file intentionally does **not** mock `grammy` — it uses the real `InlineKeyboard` (same approach as `adminCommands.test.ts`) so the `inline_keyboard`/`callback_data` assertions reflect real button output.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/conversations/announceConversation.test.ts`
Expected: FAIL — `Cannot find module '../../conversations/announceConversation.js'`

- [ ] **Step 3: Implement `announceConversation.ts`**

Create `src/conversations/announceConversation.ts`:

```ts
import { InlineKeyboard } from 'grammy';
import type { BotContext, BotConversation } from '../types/types.js';

function isEscapeCommand(text: string): boolean {
  return text.startsWith('/cancel') || text.startsWith('/announce');
}

export async function announceConversation(
  conversation: BotConversation,
  ctx: BotContext,
): Promise<void> {
  await ctx.reply('Send the message you want to broadcast to the group (or /cancel to abort).');

  const msgCtx = await conversation.waitFor('message:text');

  if (isEscapeCommand(msgCtx.message.text)) {
    await msgCtx.reply('Broadcast cancelled.');

    return;
  }

  const text = msgCtx.message.text;

  msgCtx.session.pendingBroadcast = text;

  const keyboard = new InlineKeyboard()
    .text('✅ Send', 'announce_confirm')
    .text('📌 Send & Pin', 'announce_confirm_pin')
    .row()
    .text('❌ Cancel', 'announce_cancel');

  await msgCtx.reply(`Preview — this will be sent to the group:\n\n${text}`, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/conversations/announceConversation.test.ts`
Expected: PASS (4/4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/conversations/announceConversation.ts src/__tests__/conversations/announceConversation.test.ts
git commit -m "feat: add announceConversation for prompt-and-wait /announce flow"
```

---

### Task 2: Update the `/announce` command handler

**Files:**
- Modify: `src/botsCommands/adminCommands.ts:380-407` (the `privateBot.command('announce', ...)` handler)
- Test: `src/__tests__/botsCommands/adminCommands.test.ts` (the `createCtx` helper and the `announce` describe block at lines 707-776)

**Interfaces:**
- Consumes: nothing new from Task 1 (only references the string `'announceConversation'`, not the function).
- Produces: no change to the public shape of `botAdminCommands` or the callback handlers.

- [ ] **Step 1: Update the test file (failing/red)**

In `src/__tests__/botsCommands/adminCommands.test.ts`, update the `createCtx` helper to include a mock `conversation.enter`:

```ts
  const createCtx = (userId: number, text: string = '') => ({
    from: { id: userId },
    message: { text },
    match: text.replace(/^\/\S+\s*/, ''),
    reply: jest.fn().mockReturnValue(Promise.resolve({ message_id: 456 })),
    conversation: { enter: jest.fn() },
  });
```

Replace the entire `describe('announce', ...)` block's top-level (non-callback) tests — i.e. everything from `describe('announce', () => {` down to (but not including) `describe('announce_confirm callback', ...)` — with:

```ts
  describe('announce', () => {
    it('should reject non-admins', async () => {
      const ctx = createCtx(999, '/announce Hello group');

      await handlers['announce'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
      expect(ctx.conversation.enter).not.toHaveBeenCalled();
    });

    it('should enter the announce conversation for admins', async () => {
      const ctx = createCtx(adminId, '/announce');

      await handlers['announce'](ctx);

      expect(ctx.conversation.enter).toHaveBeenCalledWith('announceConversation');
      expect(ctx.reply).not.toHaveBeenCalled();
    });

    describe('announce_confirm callback', () => {
```

(The rest of the file, starting from `describe('announce_confirm callback', ...)` onward, is unchanged.)

This removes the four now-obsolete tests (`should ask for a message if none is provided`, `should store the message in session and reply with a preview and keyboard`, `should preserve multi-line messages`, `should overwrite a previous pending broadcast on a second /announce`) — that coverage now lives in `announceConversation.test.ts` from Task 1.

- [ ] **Step 2: Run tests to verify the new test fails**

Run: `npx jest src/__tests__/botsCommands/adminCommands.test.ts -t "should enter the announce conversation for admins"`
Expected: FAIL — `ctx.conversation.enter` was not called (current handler builds the preview inline instead)

- [ ] **Step 3: Update the command handler**

In `src/botsCommands/adminCommands.ts`, replace the `privateBot.command('announce', ...)` handler (currently lines 380-407):

```ts
  // Preview + confirm/cancel broadcast to the group
  privateBot.command('announce', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("You're not allowed to do that");

      return;
    }

    const text = ctx.match?.toString().trim();

    if (!text) {
      await ctx.reply('You must include a message!\n/announce <message>');

      return;
    }

    ctx.session.pendingBroadcast = text;

    const keyboard = new InlineKeyboard()
      .text('✅ Send', 'announce_confirm')
      .text('📌 Send & Pin', 'announce_confirm_pin')
      .row()
      .text('❌ Cancel', 'announce_cancel');

    await ctx.reply(`Preview — this will be sent to the group:\n\n${text}`, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  });
```

with:

```ts
  // Prompt for and wait for the broadcast message, then preview + confirm/cancel
  privateBot.command('announce', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("You're not allowed to do that");

      return;
    }

    await ctx.conversation.enter('announceConversation');
  });
```

Leave the `announce_confirm`, `announce_confirm_pin`, `announce_pin_notify`, `announce_pin_silent`, and `announce_cancel` callback handlers below it completely unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/botsCommands/adminCommands.test.ts`
Expected: PASS (all tests in the file, including the untouched callback-handler tests)

- [ ] **Step 5: Commit**

```bash
git add src/botsCommands/adminCommands.ts src/__tests__/botsCommands/adminCommands.test.ts
git commit -m "feat: enter announceConversation from /announce instead of inline text"
```

---

### Task 3: Register `announceConversation` in `mainBot.ts`

**Files:**
- Modify: `src/bots/mainBot.ts` (imports at top, registration block around line 79)
- Test: `src/__tests__/bots/mainBot.test.ts`

**Interfaces:**
- Consumes: `announceConversation` from `../conversations/announceConversation.js` (produced by Task 1).

- [ ] **Step 1: Update the test file (failing/red)**

In `src/__tests__/bots/mainBot.test.ts`, add a mock for the new conversation module (alongside the existing `addExpenseConversation`/`onboardingConversation` mocks, near line 64):

```ts
jest.unstable_mockModule('../../conversations/announceConversation.js', () => ({
  announceConversation: jest.fn(),
}));
```

Add the corresponding import alongside the other top-level `await import(...)` calls (near line 125, after the `createBot` import):

```ts
const { announceConversation } = await import('../../conversations/announceConversation.js');
const { createConversation } = await import('@grammyjs/conversations');
```

Add a new test after `'should register language command'` (near line 287):

```ts
  it('should register the announce conversation', async () => {
    await createBot();

    expect(createConversation).toHaveBeenCalledWith(announceConversation, 'announceConversation');
  });
```

- [ ] **Step 2: Run tests to verify the new test fails**

Run: `npx jest src/__tests__/bots/mainBot.test.ts -t "should register the announce conversation"`
Expected: FAIL — `createConversation` was never called with `'announceConversation'`

- [ ] **Step 3: Register the conversation in `mainBot.ts`**

Add the import in `src/bots/mainBot.ts`, alongside the other conversation imports (after line 19's `onboardingConversation` import):

```ts
import { announceConversation } from '../conversations/announceConversation.js';
```

Add the registration in `initializeBot()`, alongside the other two (after line 79's `onboardingConversation` registration):

```ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot.use(createConversation(announceConversation as any, 'announceConversation'));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/bots/mainBot.test.ts`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Commit**

```bash
git add src/bots/mainBot.ts src/__tests__/bots/mainBot.test.ts
git commit -m "feat: register announceConversation in mainBot"
```

---

### Task 4: Full verification

No code changes — this task confirms the three preceding tasks integrate cleanly.

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass, 0 failures

- [ ] **Step 2: Run lint on the touched files**

Run: `npx eslint src/conversations/announceConversation.ts src/__tests__/conversations/announceConversation.test.ts src/botsCommands/adminCommands.ts src/__tests__/botsCommands/adminCommands.test.ts src/bots/mainBot.ts src/__tests__/bots/mainBot.test.ts`
Expected: no errors

- [ ] **Step 3: Run format check on the touched files**

Run: `npx prettier --check src/conversations/announceConversation.ts src/__tests__/conversations/announceConversation.test.ts src/botsCommands/adminCommands.ts src/__tests__/botsCommands/adminCommands.test.ts src/bots/mainBot.ts src/__tests__/bots/mainBot.test.ts`
Expected: "All matched files use Prettier code style!"

No commit — this task makes no changes.
