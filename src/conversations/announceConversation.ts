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

  // Session data must be written via `conversation.external()`, not by mutating
  // `msgCtx.session` directly. `msgCtx` is a context object built from scratch for
  // this `waitFor` call and never passes through the bot's real middleware stack.
  // `external()` runs its callback against the real, live outer context for the
  // current update, so the mutation is persisted by that context's own session
  // write-back instead of being silently discarded or clobbered by it.
  await conversation.external((extCtx) => {
    extCtx.session.pendingBroadcast = text;
  });

  const keyboard = new InlineKeyboard()
    .text('✅ Send', 'announce_confirm')
    .text('📌 Send & Pin', 'announce_confirm_pin')
    .row()
    .text('❌ Cancel', 'announce_cancel');

  await msgCtx.reply(`Preview — this will be sent to the group:\n\n${text}`, {
    reply_markup: keyboard,
  });
}
