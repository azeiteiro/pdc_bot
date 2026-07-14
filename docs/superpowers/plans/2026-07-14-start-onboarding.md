# Connect /start to Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/start` send the existing welcome message and then immediately trigger the same onboarding entry logic as `/onboarding`, in private chats only.

**Architecture:** Extract the body of the current `/onboarding` handler into an exported `startOnboardingFlow(ctx)` function in `onboardingCommands.ts`. `/onboarding` becomes a thin wrapper around it. `/start` in `mainBot.ts` gains a private-chat guard, sends the welcome message, then calls `startOnboardingFlow(ctx)`.

**Tech Stack:** TypeScript, grammY (Telegram bot framework), Jest with `jest.unstable_mockModule` (ESM mocking), better-sqlite3.

## Global Constraints

- `/onboarding` must keep working exactly as it does today (no welcome message, same status checks, same conversation entry) — it is not removed.
- `/start` only acts in private chats; in group chats it does nothing (no reply, no side effects).
- Do not change the wording of `onboarding-start-welcome` or any other onboarding message text.
- Do not add `/start` to `src/resources/commands.json`.
- No changes to `onboardingConversation.ts`, `userRepository.ts`, or the database schema.

---

### Task 1: Extract `startOnboardingFlow` from the `/onboarding` handler

**Files:**
- Modify: `src/botsCommands/onboardingCommands.ts:48-89`
- Test: `src/__tests__/botsCommands/onboardingCommands.test.ts`

**Interfaces:**
- Consumes: `getUserById`, `createOrUpdateUser` from `../storage/userRepository.js` (already imported); module-level `db: Database.Database` (already declared at line 43, set by `registerOnboardingCommands`).
- Produces: `export async function startOnboardingFlow(ctx: BotContext): Promise<void>` — consumed by Task 2's `/start` handler in `mainBot.ts`.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('/onboarding command', ...)` block in `src/__tests__/botsCommands/onboardingCommands.test.ts`, and add `startOnboardingFlow` to the import on line 27:

```ts
const { registerOnboardingCommands, startOnboardingFlow } = await import(
  '../../botsCommands/onboardingCommands.js'
);
```

```ts
    it('should export startOnboardingFlow that can be invoked directly', async () => {
      (userRepository.getUserById as jest.Mock).mockReturnValue(null);
      const ctx = createMockCtx();

      await startOnboardingFlow(ctx);

      expect(userRepository.createOrUpdateUser).toHaveBeenCalledWith(
        mockDb,
        123456,
        'testuser',
        'STARTED',
        'Test User',
      );
      expect(ctx.conversation.enter).toHaveBeenCalledWith('onboardingConversation');
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/botsCommands/onboardingCommands.test.ts -t "should export startOnboardingFlow"`
Expected: FAIL with `TypeError: startOnboardingFlow is not a function` (it isn't exported yet).

- [ ] **Step 3: Extract the function**

In `src/botsCommands/onboardingCommands.ts`, replace lines 45-89:

```ts
/**
 * Initialize onboarding commands
 */
export function registerOnboardingCommands(bot: Bot<BotContext>, database: Database.Database) {
  db = database;

  // /onboarding command
  bot.command('onboarding', async (ctx) => {
    if (ctx.chat?.type !== 'private') return;

    const userId = ctx.from?.id;
    const username = ctx.from?.username ?? null;
    const name = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || null;

    if (!userId) {
      return;
    }

    // Check user status
    const user = getUserById(db, userId);

    if (user?.onboarding_status === 'STARTED') {
      await ctx.reply(ctx.t('onboarding-already-started'));

      return;
    }

    if (user?.onboarding_status === 'WAITING_PAYMENT') {
      await ctx.reply(ctx.t('onboarding-already-waiting'));

      return;
    }

    if (user?.onboarding_status === 'COMPLETED') {
      await ctx.reply(ctx.t('onboarding-already-completed'));

      return;
    }

    // Create user with STARTED status
    createOrUpdateUser(db, userId, username, 'STARTED', name ?? undefined);

    // Enter conversation
    await ctx.conversation.enter('onboardingConversation');
  });
```

with:

```ts
/**
 * Runs the onboarding entry logic: checks the user's onboarding status and
 * either informs them of their existing progress or starts a new onboarding
 * conversation. Shared by both /onboarding and /start.
 */
export async function startOnboardingFlow(ctx: BotContext): Promise<void> {
  if (ctx.chat?.type !== 'private') return;

  const userId = ctx.from?.id;
  const username = ctx.from?.username ?? null;
  const name = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || null;

  if (!userId) {
    return;
  }

  // Check user status
  const user = getUserById(db, userId);

  if (user?.onboarding_status === 'STARTED') {
    await ctx.reply(ctx.t('onboarding-already-started'));

    return;
  }

  if (user?.onboarding_status === 'WAITING_PAYMENT') {
    await ctx.reply(ctx.t('onboarding-already-waiting'));

    return;
  }

  if (user?.onboarding_status === 'COMPLETED') {
    await ctx.reply(ctx.t('onboarding-already-completed'));

    return;
  }

  // Create user with STARTED status
  createOrUpdateUser(db, userId, username, 'STARTED', name ?? undefined);

  // Enter conversation
  await ctx.conversation.enter('onboardingConversation');
}

/**
 * Initialize onboarding commands
 */
export function registerOnboardingCommands(bot: Bot<BotContext>, database: Database.Database) {
  db = database;

  // /onboarding command
  bot.command('onboarding', startOnboardingFlow);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/botsCommands/onboardingCommands.test.ts`
Expected: PASS (all existing `/onboarding` tests continue to pass unchanged, plus the new `startOnboardingFlow` test).

- [ ] **Step 5: Commit**

```bash
git add src/botsCommands/onboardingCommands.ts src/__tests__/botsCommands/onboardingCommands.test.ts
git commit -m "refactor: extract startOnboardingFlow from /onboarding handler"
```

---

### Task 2: Wire `/start` to send welcome message and call `startOnboardingFlow`

**Files:**
- Modify: `src/bots/mainBot.ts:20` (import), `src/bots/mainBot.ts:114-116` (handler)
- Test: `src/__tests__/bots/mainBot.test.ts`
- Test: `src/__tests__/bots/mainBot.integration.test.ts` (mock update only, for consistency)

**Interfaces:**
- Consumes: `startOnboardingFlow(ctx: BotContext): Promise<void>` from Task 1 (`../botsCommands/onboardingCommands.js`).

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/bots/mainBot.test.ts`, update the mock at lines 92-94 to also expose `startOnboardingFlow`:

```ts
jest.unstable_mockModule('../../botsCommands/onboardingCommands.js', () => ({
  registerOnboardingCommands: jest.fn(),
  startOnboardingFlow: jest.fn(),
}));
```

Add the import alongside the other awaited imports (after line 118, `const { createBot } = await import('../../bots/mainBot.js');`):

```ts
const { startOnboardingFlow } = await import('../../botsCommands/onboardingCommands.js');
```

Replace the existing test at lines 223-242 (`it('should register the /start command', ...)`) with:

```ts
  it('should register the /start command', async () => {
    await createBot();

    expect(mockBotInstance.command).toHaveBeenCalledWith('start', expect.any(Function));
  });

  it('should send welcome message and start onboarding in a private chat', async () => {
    await createBot();

    const startCallback = mockBotInstance.command.mock.calls[0][1] as (
      ctx: unknown,
    ) => Promise<void>;
    const mockCtx = {
      chat: { type: 'private' },
      reply: jest.fn(),
      t: jest.fn().mockReturnValue('Welcome message'),
    };

    await startCallback(mockCtx);

    expect(mockCtx.t).toHaveBeenCalledWith('onboarding-start-welcome');
    expect(mockCtx.reply).toHaveBeenCalledWith('Welcome message');
    expect(startOnboardingFlow).toHaveBeenCalledWith(mockCtx);
  });

  it('should do nothing in a group chat', async () => {
    await createBot();

    const startCallback = mockBotInstance.command.mock.calls[0][1] as (
      ctx: unknown,
    ) => Promise<void>;
    const mockCtx = {
      chat: { type: 'group' },
      reply: jest.fn(),
      t: jest.fn().mockReturnValue('Welcome message'),
    };

    await startCallback(mockCtx);

    expect(mockCtx.reply).not.toHaveBeenCalled();
    expect(startOnboardingFlow).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/bots/mainBot.test.ts -t "should send welcome message and start onboarding in a private chat"`
Expected: FAIL — `expect(startOnboardingFlow).toHaveBeenCalledWith(mockCtx)` fails because `/start` doesn't call it yet.

Run: `npx jest src/__tests__/bots/mainBot.test.ts -t "should do nothing in a group chat"`
Expected: FAIL — `expect(mockCtx.reply).not.toHaveBeenCalled()` fails because the current handler replies unconditionally regardless of chat type.

- [ ] **Step 3: Implement the `/start` handler change**

In `src/bots/mainBot.ts`, update the import on line 20 from:

```ts
import { registerOnboardingCommands } from '../botsCommands/onboardingCommands.js';
```

to:

```ts
import { registerOnboardingCommands, startOnboardingFlow } from '../botsCommands/onboardingCommands.js';
```

Replace lines 114-116:

```ts
  telegramBot.command('start', (ctx) => {
    ctx.reply(ctx.t('onboarding-start-welcome'));
  });
```

with:

```ts
  telegramBot.command('start', async (ctx) => {
    if (ctx.chat?.type !== 'private') return;

    await ctx.reply(ctx.t('onboarding-start-welcome'));
    await startOnboardingFlow(ctx);
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/bots/mainBot.test.ts`
Expected: PASS (all tests in the file, including the three `/start`-related tests).

- [ ] **Step 5: Keep the integration test mock consistent**

In `src/__tests__/bots/mainBot.integration.test.ts`, update the mock at lines 93-95 to match the real module shape:

```ts
jest.unstable_mockModule('../../botsCommands/onboardingCommands.js', () => ({
  registerOnboardingCommands: jest.fn(),
  startOnboardingFlow: jest.fn(),
}));
```

Run: `npx jest src/__tests__/bots/mainBot.integration.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full test suite**

Run: `npx jest`
Expected: PASS, no regressions in other suites.

- [ ] **Step 7: Commit**

```bash
git add src/bots/mainBot.ts src/__tests__/bots/mainBot.test.ts src/__tests__/bots/mainBot.integration.test.ts
git commit -m "feat: trigger onboarding flow from /start command"
```
