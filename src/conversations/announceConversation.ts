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
