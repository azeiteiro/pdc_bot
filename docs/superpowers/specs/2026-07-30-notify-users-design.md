# Admin Direct-Message (`/notify`) Command

## Context

The admin has lists of specific users (identified by Telegram user ID, already known because they've started a chat with the bot) who need a targeted reminder — e.g. "You still need to confirm your departure date." This isn't a group broadcast (`/announce` already covers that) and doesn't need per-user personalization from the database (unlike `/offboarding1-3`, which pull users from `userRepository` and translate/personalize each message). The admin provides the exact ID list and message text manually, each time, since the set of affected users varies and isn't tracked in the database yet.

## Requirements

- Admin provides a list of numeric Telegram IDs and a custom message in one command invocation (multi-line supported via Shift+Enter, same mechanism `/announce` relies on).
- No conversation/session state — the command sends as soon as it's invoked (unlike `/announce`, which shows a preview + confirm button). This was a deliberate simplicity/risk trade-off agreed with the admin: reintroducing conversation + session state to get a preview step carries the same class of complexity/bugs just fixed for `/announce` (see `2026-07-29-announce-prompt-flow-design.md` and the session/`external()` fix that followed it).
- Message supports Telegram Markdown formatting, consistent with `/announce`.
- Sends independently to each user by ID — no group chat involved, no database lookup required for the send itself.
- Gated the same way as every other admin command: `isAdmin()` + `privateBot` (private chat only).
- Because there's no preview step, a malformed ID list is rejected up front (nothing is sent) to avoid a typo silently messaging the wrong set of people or garbling the list.

## Design

### Architecture

Implemented as a single plain command handler in `src/botsCommands/adminCommands.ts`, matching the existing style of `/offboarding1`/`/offboarding2` (a `for` loop over recipients, per-recipient try/catch around `bot.api.sendMessage`, `sent`/`failed` counters reported back to the admin). No new file, no `@grammyjs/conversations` flow, no new `SessionData` fields — the entire interaction is one command, one reply.

### Input Format

```
/notify
123456,789012,345678
Hey! You still need to confirm your departure date.

Please let us know by Friday.
```

- `ctx.match` (grammY's parsed command payload — a plain string slice, multi-line safe, same mechanism `/announce` uses) is split on the **first** `\n`.
- Everything before that first newline is the **IDs line**.
- Everything after it is the **message text**, used verbatim (no trimming beyond removing a single leading/trailing blank line), sent with `parse_mode: 'Markdown'`.

### Data Flow

1. `privateBot.command('notify', ...)`:
   - `isAdmin(ctx.from.id)` check — same `"You're not allowed to do that"` pattern as every other admin command.
   - Read `ctx.match?.toString() ?? ''`. If it contains no `\n` (i.e., no message body was provided), reply with a usage hint and return:
     ```
     Usage:
     /notify
     <id1>,<id2>,...
     <message text>
     ```
   - Split on the first `\n` → `idsLine`, `messageText` (`messageText` trimmed of surrounding whitespace).
   - Parse `idsLine`: split on `,`, trim each entry, drop empty entries, de-duplicate.
   - Validate every remaining entry matches `/^-?\d+$/` (Telegram user IDs are integers). If any entry fails, reply listing the invalid entries and **abort — nothing is sent**:
     ```
     Invalid IDs (must be numeric): <list>
     ```
   - If the resulting ID list is empty, reply `'No valid IDs provided.'` and abort.
   - If `messageText` is empty after trimming, reply `'Message text is empty.'` and abort.
2. Send loop:
   - For each ID (converted to `number`): `await bot.api.sendMessage(userId, messageText, { parse_mode: 'Markdown' })` in a try/catch.
   - On success: increment `sent`.
   - On failure (blocked bot, chat not found, bad Markdown, network error, etc.): log via `loggers.errorWithContext(error as Error, `/notify DM to user ${userId}`)`, increment `failed`, push `userId` onto a `failedIds` list.
3. Reply to the admin with a summary:
   ```
   Sent: <sent>
   Failed: <failed>
   Failed IDs: <failedIds joined by ", ">   // omitted entirely if failed === 0
   ```

### Error Handling

- Non-admin: existing `"You're not allowed to do that"` reply.
- No message body / no newline in input: usage hint, nothing sent.
- Any non-numeric entry in the ID list: reject the whole command up front, nothing sent — this is the main typo-safety net given there's no preview step.
- Empty ID list or empty message text after parsing: rejected with a specific reply, nothing sent.
- Per-recipient send failure: isolated via try/catch exactly like `/offboarding1`/`/offboarding2` — one recipient's failure never stops the rest of the loop, and is surfaced in the final summary's `Failed IDs` list so the admin knows who to follow up with manually.

### Registration

- Add the command handler to `src/botsCommands/adminCommands.ts`, alongside the other admin commands.
- Add an entry to `src/resources/commands.json` (`adminOnly: true`, English + Portuguese descriptions) so it appears in `/help` for admins, consistent with `/announce`, `/offboarding1`, etc.

### Testing

Extend `src/__tests__/botsCommands/adminCommands.test.ts` (same mock conventions already used there: `jest.unstable_mockModule`, `createCtx` helper, `handlers` map for `bot.command`) with:

- Non-admin is rejected, no `sendMessage` call.
- Valid multi-ID input with mixed success/failure: correct `sent`/`failed` counts, `failedIds` listed, `loggers.errorWithContext` called for each failure.
- Input with no newline (missing message body): usage hint reply, no `sendMessage` call.
- Non-numeric entry in the ID list: rejected with the invalid-entries message, no `sendMessage` call at all (not even for the valid IDs in the same list).
- Duplicate IDs in the input are de-duplicated (message sent once per unique ID).
- Empty message text after the IDs line: rejected, no `sendMessage` call.
- Multi-line message text (containing its own `\n`) is passed through to `sendMessage` unmodified.

Implemented test-first (RED → GREEN → REFACTOR) per project convention.

## Out of Scope

- Conversation/session-based preview + confirm step (explicitly rejected for this feature — see Requirements).
- Per-user-locale translation or database-driven personalization of the message (it's admin-authored freeform text, sent identically to every listed ID).
- Sourcing the ID list from the database (e.g. a new `departure_confirmed` column/flag) — out of scope for this iteration; the admin supplies IDs manually each time.
- Rate limiting beyond what grammY's existing `autoRetry` middleware and Telegram's own limits provide.
- Audit logging beyond the existing `loggers.errorWithContext` calls on a per-failure basis.
