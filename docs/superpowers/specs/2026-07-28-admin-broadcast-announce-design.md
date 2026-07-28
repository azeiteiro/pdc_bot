# Admin Broadcast (`/announce`) Command

## Context

The bot has been in production for 24 hours with ~30 users and no issues. The admin wants a way to send an ad-hoc message to the group chat through the bot (e.g. announcements), rather than posting manually in Telegram. All existing admin commands (`/create_album`, `/users`, `/offboarding1-3`, etc.) live in `src/botsCommands/adminCommands.ts`, are gated by `isAdmin()`, and run only in private chat via the `privateBot` filter.

## Requirements

- Admin types `/announce <message>` in a single message (multi-line supported via Shift+Enter — no multi-step conversation).
- Bot replies with a preview of the message plus **✅ Send** / **❌ Cancel** buttons before anything is posted to the group.
- Message supports Telegram Markdown formatting (`*bold*`, `_italic_`, etc.) — sent with `parse_mode: 'Markdown'`.
- Confirming posts the message to the group (`config.groupChatId`) as-is (no i18n translation — this is admin-authored freeform text, consistent with `/offboarding1`'s group message being single-locale).
- All existing `ADMIN_IDS` can use it — no further-restricted subset.

## Design

### Architecture

Implemented as a plain command + callback-query pair in `src/botsCommands/adminCommands.ts`, matching the existing style of every other admin command — no new file, no `@grammyjs/conversations` flow. A `@grammyjs/conversations`-based approach (like `addExpenseConversation.ts`) was considered but rejected: it only pays off for multi-turn text input, and here there's exactly one button press to wait for.

Pending broadcast text is held in `ctx.session.pendingBroadcast: string | undefined` (new optional field on `SessionData` in `src/types/types.ts`), since Telegram `callback_data` can't carry arbitrary message text (~64 byte limit) and the session is already the established place for cross-message state (SQLite-backed, survives restarts).

### Data Flow

1. `privateBot.command('announce', ...)`:
   - `isAdmin(ctx.from.id)` check — same "You're not allowed to do that" pattern as other commands.
   - Extract text via `ctx.match?.toString().trim()` (grammY's parsed command arguments — a plain string slice, so multi-line text is preserved, unlike the `.+`-based regex pattern used by `/create_album` which does not match across newlines).
   - If empty → reply `'You must include a message!\n/announce <message>'` and return.
   - Set `ctx.session.pendingBroadcast = text`.
   - Reply with `` `Preview — this will be sent to the group:\n\n${text}` `` using `parse_mode: 'Markdown'` and an inline keyboard: `.text('✅ Send', 'announce_confirm').text('❌ Cancel', 'announce_cancel')`.
   - A second `/announce` before confirming simply overwrites `pendingBroadcast` and posts a new preview (no "pending broadcast already exists" guard).

2. `bot.callbackQuery('announce_confirm', ...)`:
   - Re-check `isAdmin(ctx.from.id)` (a callback query is a separate update; identity must be re-verified, not inferred from session state).
   - If `ctx.session.pendingBroadcast` is unset (stale button, e.g. after a restart or a prior confirm/cancel), answer the callback query and edit the message to note there's nothing pending — no send attempted.
   - Otherwise: `await bot.api.sendMessage(config.groupChatId, ctx.session.pendingBroadcast, { parse_mode: 'Markdown' })`, clear `ctx.session.pendingBroadcast`, edit the preview message to `'✅ Sent to the group.'`, log via `loggers.botResponse`.
   - On `sendMessage` failure (network error or Markdown parse error from Telegram): catch, log via `loggers.errorWithContext`, clear `pendingBroadcast` (no retry loop on a possibly-malformed message), edit the message to report the failure to the admin.

3. `bot.callbackQuery('announce_cancel', ...)`:
   - Re-check `isAdmin`.
   - Clear `ctx.session.pendingBroadcast`, edit the message to `'❌ Cancelled.'`.

### Error Handling

- Non-admin: existing "You're not allowed to do that" reply, both on the command and (defensively) on the callback handlers.
- Missing message text: usage hint, no state changed.
- `sendMessage` failure: caught, logged, reported to the admin via the edited message — same try/catch shape as `/offboarding1`'s group-message send.
- Stale confirm/cancel button (no pending state): handled as a no-op rather than throwing.

### Testing

Extend `src/__tests__/botsCommands/adminCommands.test.ts` (same mock conventions: `jest.unstable_mockModule`, `createCtx` helper, `handlers` map for `bot.command`, plus a new `callbackHandlers` map for `bot.callbackQuery`) with:

- Non-admin rejection on `/announce`.
- Missing-argument usage message when no text follows `/announce`.
- Multi-line text (containing `\n`) is captured correctly and included in the preview.
- Valid input stores `pendingBroadcast` in session and replies with a preview + inline keyboard.
- `announce_confirm` sends to `config.groupChatId` with `parse_mode: 'Markdown'`, clears `pendingBroadcast`, edits the message to the "Sent" confirmation.
- `announce_confirm` with no `pendingBroadcast` set is a no-op (no `sendMessage` call).
- `announce_confirm` when `sendMessage` rejects: error is logged, `pendingBroadcast` is cleared, admin sees a failure message.
- `announce_cancel` clears `pendingBroadcast` and edits the message to the "Cancelled" confirmation, without calling `sendMessage`.
- A second `/announce` before confirming overwrites the previous `pendingBroadcast`.

Implemented test-first (RED → GREEN → REFACTOR) per project convention.

## Out of Scope

- Per-user-locale translation of the broadcast message (it's admin-authored freeform text, not an i18n key).
- Restricting the command to a subset of `ADMIN_IDS`.
- Audit logging beyond the existing `loggers.botResponse` / `loggers.errorWithContext` calls (no new persistent log of who broadcast what).
- Editing a pending broadcast in place (e.g. an "Edit" button) — cancel and re-run `/announce` covers this.
- Scheduling or delayed sends — this is immediate-only (after confirm).
