# `/announce` prompt-and-wait flow

## Context

`/announce` currently requires the admin to type the entire broadcast
message inline in the same message as the command
(`/announce <message>`), implemented as a plain `bot.command('announce', ...)`
handler in `src/botsCommands/adminCommands.ts` (see
`docs/superpowers/specs/2026-07-28-admin-broadcast-announce-design.md` for
the original design, later extended with a pin option in
`docs/superpowers/specs/2026-07-28-announce-pin-option-design.md`).

The admin has requested a UX change: `/announce` alone should prompt the
admin, then wait for their next message as the broadcast text — matching
the existing `@grammyjs/conversations`-based patterns already used for
`/expense` (`addExpenseConversation.ts`) and onboarding
(`onboardingConversation.ts`).

This change is a UX preference, not a bug fix. It does **not** address the
separate multi-line-splitting report investigated earlier (that issue was
inconclusive but most likely caused by the Telegram client sending on
plain `Enter` rather than inserting a newline — a client-side behavior
this redesign does not change, since a second incoming message is still a
second incoming message either way).

## Decision: always prompt, no inline shortcut

Unlike `/expense`, which supports both a quick inline form
(`/expense <title> <amount>`) and an interactive fallback, `/announce`
will **always** enter the wait-for-message conversation. Any text typed
after `/announce` in the same message is ignored. There is no quick-insert
shortcut for `/announce`.

## Design

### 1. New conversation — `src/conversations/announceConversation.ts`

A new `@grammyjs/conversations` conversation, following the same shape as
`addExpenseConversation.ts` and `onboardingConversation.ts`:

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

Notes:
- Plain English strings, no i18n — consistent with every other handler in
  `adminCommands.ts` (admin-facing flows in this codebase are not
  translated).
- `conversation.waitFor('message:text')` silently ignores any non-text
  update while waiting (e.g. a photo), same behavior as the existing
  `addExpenseConversation` — no special handling is added here.
- The escape check matches the existing convention in
  `addExpenseConversation.ts`/`onboardingConversation.ts`: recognizes
  `/cancel` and the flow's own command name (`/announce`).

### 2. Command handler — `src/botsCommands/adminCommands.ts`

`privateBot.command('announce', ...)` shrinks to the admin check plus
entering the conversation. The inline-text handling (`ctx.match`, the
"You must include a message!" error) is removed entirely:

```ts
privateBot.command('announce', async (ctx) => {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply("You're not allowed to do that");

    return;
  }

  await ctx.conversation.enter('announceConversation');
});
```

The five existing callback handlers (`announce_confirm`,
`announce_confirm_pin`, `announce_pin_notify`, `announce_pin_silent`,
`announce_cancel`) are **not modified**.

### 3. Registration — `src/bots/mainBot.ts`

Register the new conversation alongside the other two, following the
existing pattern:

```ts
import { announceConversation } from '../conversations/announceConversation.js';
// ...
bot.use(createConversation(announceConversation as any, 'announceConversation'));
```

### 4. Testing

- New `src/__tests__/conversations/announceConversation.test.ts`, mirroring
  the structure of `addExpenseConversation.test.ts`:
  - Escape path: `conversation.waitFor` resolves to a message whose text is
    `/cancel` (and separately `/announce`) — assert the reply is "Broadcast
    cancelled." and `ctx.session.pendingBroadcast` is left untouched.
  - Happy path: `conversation.waitFor` resolves to an arbitrary text
    message — assert `ctx.session.pendingBroadcast` is set to that text and
    the preview reply is sent with the `announce_confirm` /
    `announce_confirm_pin` / `announce_cancel` keyboard.
- Update `src/__tests__/botsCommands/adminCommands.test.ts`'s existing
  `/announce` command tests:
  - Remove the assertions that check the preview reply/keyboard directly
    from the command handler (that behavior moves to the new conversation
    test).
  - Keep/adjust the admin-check test (non-admin gets "You're not allowed to
    do that").
  - Add an assertion that an authorized admin triggers
    `ctx.conversation.enter('announceConversation')`.
- The five callback-handler tests (`announce_confirm`,
  `announce_confirm_pin`, `announce_pin_notify`, `announce_pin_silent`,
  `announce_cancel`) are unchanged — no behavior in those handlers changes.

## Out of scope

- The multi-line message splitting issue (separate, unconfirmed root
  cause, not something this redesign fixes or is intended to fix).
- Any change to `announce_confirm`, `announce_confirm_pin`,
  `announce_pin_notify`, `announce_pin_silent`, or `announce_cancel`.
- i18n/translation of any new strings.
