# Admin Direct-Message (`/notify`) Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin send a custom Markdown-formatted message to an admin-supplied list of Telegram user IDs, sent immediately (no preview/confirm step, no session/conversation state).

**Architecture:** Add a single plain `bot.command('notify', ...)` handler to the existing `src/botsCommands/adminCommands.ts` module — no new files, no `@grammyjs/conversations`, no new `SessionData` fields. The handler parses `ctx.match` (first line = comma-separated IDs, everything after = message text), validates up front, then reuses the `for` loop + per-recipient try/catch + `sent`/`failed` counters pattern already used by `offboarding1`/`offboarding2`/`offboarding3` in the same file.

**Tech Stack:** grammY (`Bot`), TypeScript, Jest (`ts-jest`, ESM via `jest.unstable_mockModule`).

## Global Constraints

- Admin gate: reuse the existing `isAdmin(userId)` helper in `adminCommands.ts` (parses `process.env.ADMIN_IDS`) — no new auth mechanism.
- Command runs only in private chat, via the existing `privateBot = bot.filter((ctx) => ctx.chat?.type === 'private')` filter already declared in `adminCommands.ts`.
- Message text is sent with `parse_mode: 'Markdown'` (Telegram's legacy Markdown, matching `/announce`'s choice — not `MarkdownV2`, not `HTML`).
- Message text is sent as-is (admin-authored freeform text) — no i18n translation key, no per-user personalization, no database lookup.
- A malformed ID list is rejected **up front** — nothing is sent to anyone if any entry is non-numeric, matching the spec's typo-safety requirement.
- Tests must follow the existing conventions in `src/__tests__/botsCommands/adminCommands.test.ts` exactly: `jest.unstable_mockModule` for dependencies, the `createCtx(userId, text)` helper (already supports `ctx.match` via `text.replace(/^\/\S+\s*/, '')`, which mirrors grammY's real `ctx.match = txt.substring(cmd.length + 1).trimStart()` computation), and a `handlers` record populated by mocking `bot.command`.
- Run tests with: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts`
- Source of truth for exact behavior: `docs/superpowers/specs/2026-07-30-notify-users-design.md`.

---

### Task 1: Implement `/notify` command (parsing, validation, send loop, summary)

**Files:**
- Modify: `src/botsCommands/adminCommands.ts` (add the `notify` command handler inside `botAdminCommands`, after the `offboarding3` block)
- Test: `src/__tests__/botsCommands/adminCommands.test.ts` (add a new `describe('notify', ...)` block, after the `offboarding3` describe block)

**Interfaces:**
- Consumes: `isAdmin(userId: number): boolean` (existing, `adminCommands.ts:25`); `bot.api.sendMessage` (existing, mocked in tests); `loggers.errorWithContext` (existing, already mocked in the test file).
- Produces: `handlers['notify']`, used only by this task's own tests.

- [ ] **Step 1: Write the failing tests**

Add the following `describe('notify', ...)` block to `src/__tests__/botsCommands/adminCommands.test.ts`, placed after the `describe('offboarding3', ...)` block and before the `describe('announce', ...)` block (or after `announce` — position doesn't affect behavior, just keep it grouped with the other admin-DM commands):

```ts
  describe('notify', () => {
    it('should reject non-admins', async () => {
      const ctx = createCtx(999, '/notify\n123\nHello');

      await handlers['notify'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
    });

    it('should show a usage hint when no message body is provided', async () => {
      const ctx = createCtx(adminId, '/notify 123,456');

      await handlers['notify'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('Usage:\n/notify\n<id1>,<id2>,...\n<message text>');
      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
    });

    it('should reject non-numeric IDs and send nothing, even for the valid IDs in the same list', async () => {
      const ctx = createCtx(adminId, '/notify\n123,abc,456\nHello there');

      await handlers['notify'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('Invalid IDs (must be numeric): abc');
      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
    });

    it('should reject an empty ID list', async () => {
      const ctx = createCtx(adminId, '/notify\n,,,\nHello there');

      await handlers['notify'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('No valid IDs provided.');
      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
    });

    it('should reject empty message text', async () => {
      const ctx = createCtx(adminId, '/notify\n123,456\n   ');

      await handlers['notify'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('Message text is empty.');
      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
    });

    it('should de-duplicate IDs and send once per unique ID', async () => {
      const ctx = createCtx(adminId, '/notify\n123,123,456\nHello there');

      await handlers['notify'](ctx);

      expect(mockBot.api.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(123, 'Hello there', {
        parse_mode: 'Markdown',
      });
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(456, 'Hello there', {
        parse_mode: 'Markdown',
      });
    });

    it('should send to each ID, report mixed success/failure, and list failed IDs', async () => {
      const ctx = createCtx(adminId, '/notify\n111,222,333\nYou still need to confirm.');

      mockBot.api.sendMessage
        .mockResolvedValueOnce({ message_id: 1 } as never)
        .mockRejectedValueOnce(new Error('bot was blocked by the user') as never)
        .mockResolvedValueOnce({ message_id: 2 } as never);

      await handlers['notify'](ctx);

      expect(loggers.errorWithContext).toHaveBeenCalledWith(
        expect.any(Error),
        '/notify DM to user 222',
      );
      expect(ctx.reply).toHaveBeenCalledWith('Sent: 2\nFailed: 1\nFailed IDs: 222');
    });

    it('should omit the Failed IDs line entirely when there are no failures', async () => {
      const ctx = createCtx(adminId, '/notify\n111,222\nAll good.');

      await handlers['notify'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('Sent: 2\nFailed: 0');
    });

    it('should pass a multi-line message through to sendMessage unmodified', async () => {
      const ctx = createCtx(adminId, '/notify\n123\nLine one\nLine two\n\nLine four');

      await handlers['notify'](ctx);

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(123, 'Line one\nLine two\n\nLine four', {
        parse_mode: 'Markdown',
      });
    });
  });
```

Notes on the trickier inputs above (verified against `createCtx`'s `match: text.replace(/^\/\S+\s*/, '')`, which mirrors grammY's real `ctx.match = txt.substring(cmd.length + 1).trimStart()`):

- `'/notify\n,,,\nHello there'` → after stripping `/notify` and the single leading `\n`, `ctx.match` is `',,,\nHello there'`. Splitting on the first `\n` gives `idsLine = ',,,'` and `messageText = 'Hello there'`. Splitting `idsLine` on `,` and dropping empty entries yields an empty list — this is what exercises the "No valid IDs provided." path (not a missing-newline case).
- `'/notify\n123,456\n   '` → `ctx.match` is `'123,456\n   '`. `messageText` before trimming is `'   '`, which trims to `''` — this exercises "Message text is empty." after the IDs line was valid.
- A single line with no `\n` at all (e.g. `'/notify 123,456'`) exercises the usage-hint path, since `ctx.match` here is `'123,456'` with no newline.

- [ ] **Step 2: Run tests to verify they fail**

Run: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts -t notify`

Expected: FAIL with `TypeError: handlers['notify'] is not a function` (no `notify` command registered yet).

- [ ] **Step 3: Implement the `/notify` command**

In `src/botsCommands/adminCommands.ts`, add the following command registration inside `botAdminCommands`, after the `offboarding3` command block (after line 377, before the `announce` command block):

```ts
  // Send a custom message to an admin-supplied list of Telegram user IDs
  privateBot.command('notify', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("You're not allowed to do that");

      return;
    }

    const payload = ctx.match?.toString() ?? '';
    const newlineIndex = payload.indexOf('\n');

    if (newlineIndex === -1) {
      await ctx.reply('Usage:\n/notify\n<id1>,<id2>,...\n<message text>');

      return;
    }

    const idsLine = payload.slice(0, newlineIndex);
    const messageText = payload.slice(newlineIndex + 1).trim();

    const uniqueIds = [
      ...new Set(
        idsLine
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0),
      ),
    ];

    const invalidIds = uniqueIds.filter((id) => !/^-?\d+$/.test(id));

    if (invalidIds.length > 0) {
      await ctx.reply(`Invalid IDs (must be numeric): ${invalidIds.join(', ')}`);

      return;
    }

    if (uniqueIds.length === 0) {
      await ctx.reply('No valid IDs provided.');

      return;
    }

    if (messageText.length === 0) {
      await ctx.reply('Message text is empty.');

      return;
    }

    let sent = 0;
    let failed = 0;
    const failedIds: string[] = [];

    for (const idStr of uniqueIds) {
      const userId = Number(idStr);

      try {
        await bot.api.sendMessage(userId, messageText, { parse_mode: 'Markdown' });
        sent++;
      } catch (error) {
        loggers.errorWithContext(error as Error, `/notify DM to user ${userId}`);
        failed++;
        failedIds.push(idStr);
      }
    }

    let summary = `Sent: ${sent}\nFailed: ${failed}`;

    if (failed > 0) {
      summary += `\nFailed IDs: ${failedIds.join(', ')}`;
    }

    await ctx.reply(summary);
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts -t notify`

Expected: PASS (9 new tests). Then run the full file to confirm no regressions:

Run: `NODE_OPTIONS='--experimental-vm-modules --no-warnings' LOG_LEVEL=silent GOOGLE_CLIENT_ID=test-id GOOGLE_CLIENT_SECRET=test-secret GOOGLE_REDIRECT_URL=http://localhost npx jest src/__tests__/botsCommands/adminCommands.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/botsCommands/adminCommands.ts src/__tests__/botsCommands/adminCommands.test.ts
git commit -m "feat: add /notify command to DM a custom message to a list of user IDs"
```

---

### Task 2: Register `/notify` in the admin command menu

**Files:**
- Modify: `src/resources/commands.json`

**Interfaces:**
- Consumes: none (data-only change).
- Produces: none consumed by other tasks — this only affects `setUserCommands` (`src/utils/utils.ts`), which is already tested against its own fixture data (`src/__tests__/utils/utils.test.ts`) and unaffected by this change.

This is a data-only change with no new behavior in this codebase to unit test, so there's no RED step — just add the entry and verify via a manual JSON validity check and the existing test suite.

- [ ] **Step 1: Add the `notify` entry**

In `src/resources/commands.json`, add a new entry after the `announce` entry (to group it with the other admin-facing broadcast/messaging commands):

```json
  {
    "command": "notify",
    "description": "Send a Markdown-formatted message to a list of Telegram user IDs (first line: comma-separated IDs, rest: message)",
    "description_pt": "Enviar uma mensagem em Markdown a uma lista de IDs do Telegram (primeira linha: IDs separados por vírgula, resto: mensagem)",
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
git commit -m "feat: add /notify to the admin command menu"
```

---

### Task 3: Full verification

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

Note for the implementer: after deploying, manually test `/notify` end-to-end against the real bot in a private chat as an admin — send a real `/notify` with your own Telegram ID as the single recipient and a short Markdown message, confirm you receive it correctly formatted, and confirm the summary reply shows `Sent: 1\nFailed: 0`. This plan's automated tests mock `bot.api.sendMessage`, so a real send is the only way to catch a malformed-Markdown edge case Telegram might reject that the mocks wouldn't surface.

---

## Self-Review Notes

- **Spec coverage:** All spec requirements are covered — admin gate + usage hint for missing body (Task 1), first-line/rest-of-payload parsing (Task 1), numeric ID validation with nothing sent on any invalid entry (Task 1), empty-ID-list and empty-message-text rejection (Task 1), de-duplication (Task 1), per-recipient try/catch with `sent`/`failed`/`failedIds` and `loggers.errorWithContext` (Task 1), summary reply format with `Failed IDs` line omitted when `failed === 0` (Task 1), Markdown `parse_mode` (Task 1), multi-line message passthrough (Task 1), `commands.json` registration with EN+PT descriptions and `adminOnly: true` (Task 2).
- **Type consistency:** `uniqueIds: string[]`, `invalidIds: string[]`, `failedIds: string[]` are used consistently within the single handler in Task 1 — no cross-task type dependencies exist since this feature is a single self-contained command handler (unlike `/announce`, which spanned a command + two callbacks sharing `ctx.session.pendingBroadcast`).
- **No placeholders:** every step has literal code, exact file paths, and exact test/run commands, matching the structure of the existing `2026-07-28-admin-broadcast-announce.md` plan.
