# Announce Pin Option — Design Spec

## Goal

Extend the existing `/announce` broadcast feature (spec:
`2026-07-28-admin-broadcast-announce-design.md`) so an admin can optionally
pin the broadcast message in the group chat immediately after sending it.

## Background

`/announce <message>` currently shows a preview with two buttons:
`✅ Send` and `❌ Cancel`. This adds a third option, `📌 Send & Pin`, and a
follow-up prompt for pin-notification preference when that option is chosen.
The plain `✅ Send` and `❌ Cancel` paths are unchanged.

## Flow

1. **Preview screen** (`privateBot.command('announce', ...)`): the inline
   keyboard gains a third button. Row layout:
   - Row 1: `✅ Send` (`announce_confirm`), `📌 Send & Pin` (`announce_confirm_pin`)
   - Row 2: `❌ Cancel` (`announce_cancel`)
   No other change to this handler — `ctx.session.pendingBroadcast` is set
   exactly as today.

2. **`✅ Send`** (`announce_confirm`) and **`❌ Cancel`** (`announce_cancel`):
   unchanged from the current implementation.

3. **`📌 Send & Pin`** (new `announce_confirm_pin` callback):
   - Independent admin check (`isAdmin`), same pattern as the other callbacks.
   - "Nothing pending" guard on `ctx.session.pendingBroadcast`, same wording
     as `announce_confirm`'s guard.
   - `try { const sent = await bot.api.sendMessage(config.groupChatId, pendingBroadcast, { parse_mode: 'Markdown' }); }`
     wraps only the send call, mirroring the narrowed try/catch already used
     in `announce_confirm`.
   - On send failure: same behavior as `announce_confirm`'s failure path —
     log via `loggers.errorWithContext`, clear `pendingBroadcast`, answer the
     callback, edit to `❌ Failed to send the broadcast. Please try /announce again.`
   - On send success: clear `pendingBroadcast`, store
     `ctx.session.pendingPinMessageId = sent.message_id`, answer the
     callback, and edit the message to:
     ```
     ✅ Sent to the group.

     Pin this message?
     ```
     with a new inline keyboard: `🔔 Notify` (`announce_pin_notify`),
     `🔕 Silent` (`announce_pin_silent`).

4. **`🔔 Notify`** (`announce_pin_notify`) / **`🔕 Silent`** (`announce_pin_silent`):
   - Independent admin check, same pattern.
   - "Nothing pending" guard on `ctx.session.pendingPinMessageId` — if unset,
     answer the callback and edit to
     `Nothing pending — this pin decision was already made.`
   - `try { await bot.api.pinChatMessage(config.groupChatId, pendingPinMessageId, { disable_notification: <true for Silent, false for Notify> }); }`
   - On success: clear `pendingPinMessageId`, answer the callback, edit to
     `✅ Sent to the group and pinned.`, log via `loggers.botResponse`.
   - On failure (e.g. bot lacks the `can_pin_messages` right): log via
     `loggers.errorWithContext`, clear `pendingPinMessageId`, answer the
     callback, edit to
     `✅ Sent to the group (pin failed — check bot permissions).`
     The broadcast itself is never rolled back or reported as failed —
     only the pin step failed.

## Data Model

`SessionData` (`src/types/types.ts`) gains one new optional field alongside
the existing `pendingBroadcast`:

```ts
pendingPinMessageId?: number;
```

Holds the `message_id` of the just-sent broadcast while the admin is
deciding between `🔔 Notify` and `🔕 Silent`. Cleared once that decision is
acted on (success or failure), same lifecycle pattern as `pendingBroadcast`.

## Error Handling

- Sending the broadcast and pinning it are two independent operations with
  independent failure handling. A pin failure never implies the broadcast
  wasn't sent — the success message already changed to `✅ Sent to the
  group.` before the pin question even appears.
- All four new/existing callback handlers (`announce_confirm`,
  `announce_confirm_pin`, `announce_pin_notify`, `announce_pin_silent`,
  `announce_cancel`) independently re-verify `isAdmin(ctx.from.id)`, since
  callback queries are separate updates from the original command.

## Testing

Extends `src/__tests__/botsCommands/adminCommands.test.ts`:

- `announce` command: update the existing preview test to assert the
  3-button keyboard shape (`✅ Send` / `📌 Send & Pin` / `❌ Cancel`).
- `announce_confirm_pin` callback: non-admin rejection, nothing-pending
  guard, successful send stores `pendingPinMessageId` and shows the
  notify/silent keyboard, `sendMessage` rejection handled the same as
  `announce_confirm`.
- `announce_pin_notify` / `announce_pin_silent` callbacks: non-admin
  rejection, nothing-pending guard, successful pin calls
  `bot.api.pinChatMessage` with the correct `disable_notification` value
  and clears `pendingPinMessageId`, `pinChatMessage` rejection reports the
  "sent but pin failed" message rather than a full failure.

## Out of Scope

- Unpinning previously-pinned announcements.
- Editing an announcement after it's been sent/pinned.
- Any change to the plain `✅ Send` / `❌ Cancel` paths.
