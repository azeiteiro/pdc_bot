# Admin Broadcast (`/announce`) Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin send a Markdown-formatted message to the group chat through the bot, with a preview + confirm/cancel step before it's actually posted.

**Architecture:** Add a plain `bot.command('announce', ...)` handler plus two `bot.callbackQuery(...)` handlers (`announce_confirm`, `announce_cancel`) to the existing `src/botsCommands/adminCommands.ts` module — no new files, no `@grammyjs/conversations`. Pending broadcast text is held in `ctx.session.pendingBroadcast` (new optional `SessionData` field) between the command and the button press.

**Tech Stack:** grammY (`Bot`, `InlineKeyboard`), TypeScript, Jest (`ts-jest`, ESM via `jest.unstable_mockModule`).

## Global Constraints

- Admin gate: reuse the existing `isAdmin(userId)` helper in `adminCommands.ts` (parses `process.env.ADMIN_IDS`) — no new auth mechanism.
- Command runs only in private chat, via the existing `privateBot = bot.filter((ctx) => ctx.chat?.type === 'private')` filter already declared in `adminCommands.ts`.
- Broadcast text is sent to the group with `parse_mode: 'Markdown'` (Telegram's legacy Markdown, matching the user's explicit choice — not `MarkdownV2` and not `HTML`).
- Broadcast text is sent as-is (admin-authored freeform text) — no i18n translation key.
- All existing `ADMIN_IDS` may use the command — no further-restricted subset.
- Group chat target is `config.groupChatId` (from `src/config/environment.ts`), not `process.env.GROUP_CHAT_ID` directly — this is the one place in `adminCommands.ts` that will read from `config` instead of `process.env`, since `config.groupChatId` is validated at startup.
- Tests must follow the existing conventions in `src/__tests__/botsCommands/adminCommands.test.ts` exactly: `jest.unstable_mockModule` for dependencies, the `createCtx(userId, text)` helper, a `handlers` record populated by mocking `bot.command`, and (new) a `callbackHandlers` record populated by mocking `bot.callbackQuery`.
- Run tests with: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts`

---

### Task 1: Add `pendingBroadcast` to `SessionData` and extend the test mock bot with `callbackQuery`

**Files:**
- Modify: `src/types/types.ts:118-127` (the `SessionData` interface)
- Modify: `src/__tests__/botsCommands/adminCommands.test.ts:62-93` (mock bot + `beforeEach`)

**Interfaces:**
- Produces: `SessionData.pendingBroadcast?: string` — used by Task 2/3/4's handlers via `ctx.session.pendingBroadcast`.
- Produces: test helper `callbackHandlers: Record<string, (...args: any[]) => any>` populated by the mocked `mockBot.callbackQuery`, and a `createCallbackCtx(userId)` test helper (see Step 3) — used by Task 3/4's tests via `callbackHandlers['announce_confirm'](ctx)` / `callbackHandlers['announce_cancel'](ctx)`.

This task has no independent behavior to test (it's type + test-scaffolding only), so it's verified by compilation and by the existing test suite still passing — not a new failing test. This is the one exception to strict TDD in this plan, since there's no behavior yet to assert on.

- [ ] **Step 1: Add the new session field**

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
}
```

- [ ] **Step 2: Extend the mock bot in the test file to support `callbackQuery`**

In `src/__tests__/botsCommands/adminCommands.test.ts`, change the `mockBot` type declaration and construction to also capture callback query handlers. Replace:

```ts
  let mockBot: { filter: jest.Mock; command: jest.Mock; api: { sendMessage: jest.Mock } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handlers: Record<string, (...args: any[]) => any> = {};
  const adminId = 123;
```

with:

```ts
  let mockBot: {
    filter: jest.Mock;
    command: jest.Mock;
    callbackQuery: jest.Mock;
    api: { sendMessage: jest.Mock };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handlers: Record<string, (...args: any[]) => any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let callbackHandlers: Record<string, (...args: any[]) => any> = {};
  const adminId = 123;
```

Then update `beforeEach` — replace:

```ts
  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};
    process.env.ADMIN_IDS = `[${adminId}]`;
    process.env.ONBOARDING_SPREADSHEET_ID = 'test-sheet-id';
    process.env.GROUP_CHAT_ID = 'group-chat-123';
    process.env.MBWAY_NUMBER = '912345678';
    process.env.PAYPAL_ME_USERNAME = 'azeiteiro';
    process.env.BANK_IBAN = 'PT50000000000000000000000';

    mockBot = {
      filter: jest.fn().mockReturnThis(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: jest.fn((cmd: string, handler: (...args: any[]) => any) => {
        handlers[cmd] = handler;
      }) as unknown as jest.Mock,
      api: {
        sendMessage: jest.fn().mockResolvedValue({} as never),
      },
    };

    botAdminCommands(mockBot as unknown as Bot<BotContext>, mockDb);
  });
```

with:

```ts
  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};
    callbackHandlers = {};
    process.env.ADMIN_IDS = `[${adminId}]`;
    process.env.ONBOARDING_SPREADSHEET_ID = 'test-sheet-id';
    process.env.GROUP_CHAT_ID = 'group-chat-123';
    process.env.MBWAY_NUMBER = '912345678';
    process.env.PAYPAL_ME_USERNAME = 'azeiteiro';
    process.env.BANK_IBAN = 'PT50000000000000000000000';

    mockBot = {
      filter: jest.fn().mockReturnThis(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: jest.fn((cmd: string, handler: (...args: any[]) => any) => {
        handlers[cmd] = handler;
      }) as unknown as jest.Mock,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callbackQuery: jest.fn((trigger: string, handler: (...args: any[]) => any) => {
        callbackHandlers[trigger] = handler;
      }) as unknown as jest.Mock,
      api: {
        sendMessage: jest.fn().mockResolvedValue({} as never),
      },
    };

    botAdminCommands(mockBot as unknown as Bot<BotContext>, mockDb);
  });
```

- [ ] **Step 3: Add a `createCallbackCtx` test helper next to `createCtx`**

Immediately after the existing `createCtx` helper (around line 99), add:

```ts
  const createCallbackCtx = (userId: number, session: { pendingBroadcast?: string } = {}) => ({
    from: { id: userId },
    session,
    match: undefined,
    reply: jest.fn().mockReturnValue(Promise.resolve({ message_id: 456 })),
    answerCallbackQuery: jest.fn().mockResolvedValue({} as never),
    editMessageText: jest.fn().mockResolvedValue({} as never),
  });
```

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

Run: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts`
Expected: All existing tests still PASS (the new `callbackQuery` mock and `pendingBroadcast` field are additive and unused so far).

- [ ] **Step 5: Commit**

```bash
git add src/types/types.ts src/__tests__/botsCommands/adminCommands.test.ts
git commit -m "test: add pendingBroadcast session field and callbackQuery test scaffolding"
```

---

### Task 2: Implement `/announce` command (validation, admin gate, preview)

**Files:**
- Modify: `src/botsCommands/adminCommands.ts` (add `import { config } from '../config/environment.js';` near the top, add the `announce` command handler inside `botAdminCommands`)
- Test: `src/__tests__/botsCommands/adminCommands.test.ts`

**Interfaces:**
- Consumes: `isAdmin(userId: number): boolean` (existing, `adminCommands.ts:24`); `ctx.session.pendingBroadcast?: string` (Task 1).
- Produces: the `handlers['announce']` handler, used by Task 2's own tests (and unaffected by Task 3/4).

- [ ] **Step 1: Write the failing tests**

Add a new `describe('announce', ...)` block to `src/__tests__/botsCommands/adminCommands.test.ts` (place it after the `offboarding3` describe block, before the closing `});` of the outer `describe('adminCommands', ...)`):

```ts
  describe('announce', () => {
    it('should reject non-admins', async () => {
      const ctx = createCtx(999, '/announce Hello group');

      await handlers['announce'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
    });

    it('should ask for a message if none is provided', async () => {
      const ctx = createCtx(adminId, '/announce');

      await handlers['announce'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('You must include a message'),
      );
    });

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
                expect.objectContaining({ callback_data: 'announce_cancel' }),
              ],
            ],
          }),
        }),
      );
    });

    it('should preserve multi-line messages', async () => {
      const ctx = createCtx(adminId, '/announce Line one\nLine two');

      (ctx as unknown as { session: { pendingBroadcast?: string } }).session = {};

      await handlers['announce'](ctx);

      expect(
        (ctx as unknown as { session: { pendingBroadcast?: string } }).session.pendingBroadcast,
      ).toBe('Line one\nLine two');
    });

    it('should overwrite a previous pending broadcast on a second /announce', async () => {
      const ctx = createCtx(adminId, '/announce Second message');

      (ctx as unknown as { session: { pendingBroadcast?: string } }).session = {
        pendingBroadcast: 'First message',
      };

      await handlers['announce'](ctx);

      expect(
        (ctx as unknown as { session: { pendingBroadcast?: string } }).session.pendingBroadcast,
      ).toBe('Second message');
    });
  });
```

Note: `createCtx` doesn't set `ctx.match` (grammY's parsed command argument), and the handler will read the message text via `ctx.match`. Since `createCtx` builds a plain object (not a real grammY context), add `match` support to `createCtx` in the same edit — update the helper (around line 95) from:

```ts
  const createCtx = (userId: number, text: string = '') => ({
    from: { id: userId },
    message: { text },
    reply: jest.fn().mockReturnValue(Promise.resolve({ message_id: 456 })),
  });
```

to:

```ts
  const createCtx = (userId: number, text: string = '') => ({
    from: { id: userId },
    message: { text },
    match: text.replace(/^\/\S+\s*/, ''),
    reply: jest.fn().mockReturnValue(Promise.resolve({ message_id: 456 })),
  });
```

This mirrors what grammY's real `ctx.match` contains for `bot.command()` handlers (the text after the command name, trimmed of the leading space) without needing the real grammY runtime in the unit test.

- [ ] **Step 2: Run tests to verify they fail**

Run: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts -t announce`
Expected: FAIL with `TypeError: handlers['announce'] is not a function` (no `announce` command registered yet).

- [ ] **Step 3: Implement the `/announce` command**

In `src/botsCommands/adminCommands.ts`, add the import near the top (after the existing imports, e.g. after the `paymentLink` import):

```ts
import { config } from '../config/environment.js';
```

Then add the following command registration inside `botAdminCommands`, after the `offboarding3` command block and before the closing `};` of the function:

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
      .text('❌ Cancel', 'announce_cancel');

    await ctx.reply(`Preview — this will be sent to the group:\n\n${text}`, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts -t announce`
Expected: PASS (5 new tests). Then run the full file to confirm no regressions:
Run: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/botsCommands/adminCommands.ts src/__tests__/botsCommands/adminCommands.test.ts
git commit -m "feat: add /announce command with Markdown preview"
```

---

### Task 3: Implement `announce_confirm` callback handler

**Files:**
- Modify: `src/botsCommands/adminCommands.ts`
- Test: `src/__tests__/botsCommands/adminCommands.test.ts`

**Interfaces:**
- Consumes: `isAdmin`, `ctx.session.pendingBroadcast` (Task 1/2), `config.groupChatId` (from `src/config/environment.ts`), `loggers.botResponse` / `loggers.errorWithContext` (existing, already mocked in the test file).
- Produces: `callbackHandlers['announce_confirm']`, used only by this task's tests.

- [ ] **Step 1: Write the failing tests**

Add to the `describe('announce', ...)` block from Task 2:

```ts
    describe('announce_confirm callback', () => {
      it('should reject non-admins', async () => {
        const ctx = createCallbackCtx(999, { pendingBroadcast: 'Hello' });

        await callbackHandlers['announce_confirm'](ctx);
        expect(ctx.answerCallbackQuery).toHaveBeenCalledWith("You're not allowed to do that");
        expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
      });

      it('should be a no-op when there is no pending broadcast', async () => {
        const ctx = createCallbackCtx(adminId, {});

        await callbackHandlers['announce_confirm'](ctx);

        expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Nothing pending'),
        );
      });

      it('should send the pending broadcast to the group and clear it', async () => {
        const ctx = createCallbackCtx(adminId, { pendingBroadcast: 'Party tonight at *9pm*!' });

        await callbackHandlers['announce_confirm'](ctx);

        expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
          'group-chat-123',
          'Party tonight at *9pm*!',
          { parse_mode: 'Markdown' },
        );
        expect(ctx.session.pendingBroadcast).toBeUndefined();
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Sent to the group'),
        );
      });

      it('should report a failure and clear the pending broadcast if sendMessage rejects', async () => {
        const ctx = createCallbackCtx(adminId, { pendingBroadcast: 'Party tonight!' });

        mockBot.api.sendMessage.mockRejectedValueOnce(new Error('network error') as never);

        await callbackHandlers['announce_confirm'](ctx);

        expect(loggers.errorWithContext).toHaveBeenCalledWith(
          expect.any(Error),
          '/announce group send',
        );
        expect(ctx.session.pendingBroadcast).toBeUndefined();
        expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining('Failed to send'));
      });
    });
```

Note: `config.groupChatId` is read from the already-validated environment config singleton, which reads `process.env.GROUP_CHAT_ID` once at import time. The existing test file already mocks `process.env.GROUP_CHAT_ID = 'group-chat-123'` in `beforeEach`, but since `config` is a module-level singleton evaluated at first import (not per-test), the module under test needs `config.groupChatId` to already resolve to `'group-chat-123'` when the test file's module graph loads. Since `src/config/environment.ts` is not mocked in this test file today, and `process.env.GROUP_CHAT_ID` is set in `beforeEach` (which runs after module load), this requires mocking the environment module. Add this mock alongside the other `jest.unstable_mockModule` calls near the top of the test file (after the existing `utils.js` mock, before the `import { Bot } from 'grammy';` line):

```ts
jest.unstable_mockModule('../../config/environment.js', () => ({
  config: { groupChatId: 'group-chat-123' },
}));
```

And add the corresponding dynamic import alongside the other awaited imports:

```ts
const { config } = await import('../../config/environment.js');
```

(This import isn't directly referenced in the test file's assertions — it exists so the mock is wired up before `adminCommands.js` is imported. The `group-chat-123` literal used in assertions above matches this mock directly, so the `beforeEach`'s `process.env.GROUP_CHAT_ID = 'group-chat-123'` line becomes redundant for this module going forward, but should be left in place since other admin commands (`offboarding1`) still read `process.env.GROUP_CHAT_ID` directly.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts -t announce_confirm`
Expected: FAIL with `TypeError: callbackHandlers['announce_confirm'] is not a function`.

- [ ] **Step 3: Implement the `announce_confirm` handler**

In `src/botsCommands/adminCommands.ts`, add after the `announce` command block from Task 2:

```ts
  bot.callbackQuery('announce_confirm', async (ctx) => {
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

    try {
      await bot.api.sendMessage(config.groupChatId, pendingBroadcast, { parse_mode: 'Markdown' });
      ctx.session.pendingBroadcast = undefined;
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('✅ Sent to the group.');
      loggers.botResponse(ctx.from.id, `Broadcast sent: ${pendingBroadcast}`);
    } catch (error) {
      loggers.errorWithContext(error as Error, '/announce group send');
      ctx.session.pendingBroadcast = undefined;
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('❌ Failed to send the broadcast. Please try /announce again.');
    }
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts -t announce`
Expected: PASS. Then run the full file:
Run: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/botsCommands/adminCommands.ts src/__tests__/botsCommands/adminCommands.test.ts
git commit -m "feat: send confirmed broadcast to the group via announce_confirm"
```

---

### Task 4: Implement `announce_cancel` callback handler

**Files:**
- Modify: `src/botsCommands/adminCommands.ts`
- Test: `src/__tests__/botsCommands/adminCommands.test.ts`

**Interfaces:**
- Consumes: `isAdmin`, `ctx.session.pendingBroadcast` (Task 1/2).
- Produces: `callbackHandlers['announce_cancel']`, used only by this task's tests.

- [ ] **Step 1: Write the failing tests**

Add to the `describe('announce', ...)` block, alongside the `announce_confirm callback` block:

```ts
    describe('announce_cancel callback', () => {
      it('should reject non-admins', async () => {
        const ctx = createCallbackCtx(999, { pendingBroadcast: 'Hello' });

        await callbackHandlers['announce_cancel'](ctx);
        expect(ctx.answerCallbackQuery).toHaveBeenCalledWith("You're not allowed to do that");
        expect(ctx.editMessageText).not.toHaveBeenCalled();
      });

      it('should clear the pending broadcast and confirm cancellation', async () => {
        const ctx = createCallbackCtx(adminId, { pendingBroadcast: 'Party tonight!' });

        await callbackHandlers['announce_cancel'](ctx);

        expect(ctx.session.pendingBroadcast).toBeUndefined();
        expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
        expect(ctx.editMessageText).toHaveBeenCalledWith('❌ Cancelled.');
      });
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts -t announce_cancel`
Expected: FAIL with `TypeError: callbackHandlers['announce_cancel'] is not a function`.

- [ ] **Step 3: Implement the `announce_cancel` handler**

In `src/botsCommands/adminCommands.ts`, add after the `announce_confirm` block from Task 3:

```ts
  bot.callbackQuery('announce_cancel', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCallbackQuery("You're not allowed to do that");

      return;
    }

    ctx.session.pendingBroadcast = undefined;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('❌ Cancelled.');
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/botsCommands/adminCommands.ts src/__tests__/botsCommands/adminCommands.test.ts
git commit -m "feat: cancel a pending broadcast via announce_cancel"
```

---

### Task 5: Register `/announce` in the admin command menu

**Files:**
- Modify: `src/resources/commands.json`

**Interfaces:**
- Consumes: none (data-only change).
- Produces: none consumed by other tasks — this only affects `setUserCommands` (`src/utils/utils.ts`), which is already tested against its own fixture data (`src/__tests__/utils/utils.test.ts`) and unaffected by this change.

This is a data-only change with no new behavior in this codebase to unit test (the existing `setUserCommands` test uses its own mocked command list, not this file), so there's no RED step — just add the entry and verify via a manual JSON validity check and the existing test suite.

- [ ] **Step 1: Add the `announce` entry**

In `src/resources/commands.json`, add a new entry after the `create_album` entry (to group it with the other admin-facing broadcast/messaging commands):

```json
  {
    "command": "announce",
    "description": "Send a Markdown-formatted message to the group, with preview + confirm",
    "description_pt": "Enviar uma mensagem em Markdown para o grupo, com pré-visualização e confirmação",
    "adminOnly": true
  },
```

- [ ] **Step 2: Verify the JSON is valid and the existing test suite still passes**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/resources/commands.json', 'utf8')); console.log('valid JSON')"`
Expected: prints `valid JSON`.

Run: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/utils/utils.test.ts src/__tests__/utils/dataLoader.test.ts`
Expected: All tests PASS (unaffected, since they use their own fixture data, not this file).

- [ ] **Step 3: Commit**

```bash
git add src/resources/commands.json
git commit -m "feat: add /announce to the admin command menu"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite with coverage**

Run: `npm test`
Expected: All tests PASS, coverage thresholds met (50% lines, 40% branches/functions, 50% statements — unchanged from current config).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Run format check**

Run: `npm run format:check`
Expected: No errors. If it fails only on files touched in this plan, run `npm run format` and re-verify, then amend the affected commit(s) or add a small formatting commit.

- [ ] **Step 4: Manual smoke test reminder (not automated)**

Note for the implementer: after deploying, manually test `/announce` end-to-end against the real bot in a private chat as an admin — send `/announce *test*`, confirm the preview renders bold correctly, press ✅ Send, and confirm the group receives the formatted message. This plan's automated tests mock `bot.api.sendMessage` and Telegram's Markdown rendering, so a real send is the only way to catch a malformed-Markdown edge case Telegram might reject that the mocks wouldn't surface.

---

## Self-Review Notes

- **Spec coverage:** All spec sections are covered — command flow (Task 2), confirm/send (Task 3), cancel (Task 4), error handling for missing text (Task 2) and failed send (Task 3), multi-line support (Task 2), overwrite-on-second-`/announce` (Task 2), admin gate on both the command and both callbacks (Tasks 2-4), command menu registration (Task 5, implied by "all `ADMIN_IDS` can use it" needing menu visibility — added as it follows the codebase's existing convention for every other admin command in `commands.json`).
- **Type consistency:** `pendingBroadcast?: string` (Task 1) is read/written identically in Tasks 2-4 (`ctx.session.pendingBroadcast`). `config.groupChatId` (Task 3) matches the field name in `EnvironmentConfig` (`src/config/environment.ts:13`). Callback data strings (`'announce_confirm'`, `'announce_cancel'`) match exactly between the `InlineKeyboard` construction (Task 2) and the `bot.callbackQuery(...)` registrations (Tasks 3-4).
- **No placeholders:** every step has literal code, exact file paths, and exact test/run commands.
