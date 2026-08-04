import { Bot, InlineKeyboard } from 'grammy';
import type Database from 'better-sqlite3';
import type { BotContext } from '../types/types.js';
import { createAlbum, getAlbumInfo, getAlbums } from '../googleApi/googlePhotosAPI.js';
import { loggers } from '../utils/logger.js';
import { getSheetData, getOffboardingBalances } from '../googleApi/googleSheetsApi.js';
import { formatExpenses } from '../utils/formatters.js';
import { generateDailyMessage } from '../utils/utils.js';
import { getAllCompletedUsers, getAllUsers, getUserById } from '../storage/userRepository.js';
import { i18n } from '../config/i18n.js';
import { buildRevolutPaymentLink, buildPaypalPaymentLink } from '../utils/paymentLink.js';
import { config } from '../config/environment.js';

/**
 * Escape HTML special characters so free-text values (e.g. a user's Telegram name)
 * can be safely interpolated into a message sent with parse_mode: 'HTML'
 */
const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Check if a user ID is in the admin list
 * Safely parses ADMIN_IDS from environment and checks membership
 */
const isAdmin = (userId: number): boolean => {
  try {
    const adminIds = JSON.parse(process.env.ADMIN_IDS || '[]') as number[];

    return adminIds.includes(userId);
  } catch (error) {
    loggers.errorWithContext(error as Error, 'Admin ID parsing');

    return false;
  }
};

const botAdminCommands = (bot: Bot<BotContext>, db: Database.Database) => {
  // Only handle admin commands in private chats — silently ignore group messages
  const privateBot = bot.filter((ctx) => ctx.chat?.type === 'private');

  // Create a new album in Google Photos
  privateBot.command('create_album', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      const response = "You're not allowed to do that";

      await ctx.reply(response);
      loggers.botResponse(ctx.from?.id || 0, response);

      return;
    }

    const commandPattern = /^\/create_album\s+(.+)$/;
    const userMessage = ctx.message?.text || '';

    if (commandPattern.test(userMessage)) {
      const parts = userMessage.split('/create_album ');
      const albumName = parts[1].trim();

      await ctx.reply('Creating the album, please wait');
      const albumStatus = await createAlbum(albumName);

      await ctx.reply(albumStatus);
      loggers.botResponse(ctx.from!.id, albumStatus);
    } else {
      await ctx.reply('You must specify an album name!\n /create_album <album name>');
    }
  });

  // List Google Photos albums
  privateBot.command('albums', async (ctx) => {
    const albums = await getAlbums();

    let response = '';

    albums.forEach((album) => {
      response += `${album.title}\n`;
    });

    await ctx.reply(response);
    loggers.botResponse(ctx.from?.id || 0, response);
  });

  privateBot.command('albumInfo', async (ctx) => {
    const commandPattern = /^\/albumInfo\s+\S+$/;
    const userMessage = ctx.message?.text || '';

    if (commandPattern.test(userMessage)) {
      const albumId = userMessage.split(' ')[1];
      const message = await ctx.reply('Getting album info, please wait');

      try {
        const albumInfo = await getAlbumInfo(albumId);

        await ctx.reply(`Title: ${albumInfo.title} - ${albumInfo.productUrl}`, {
          reply_parameters: { message_id: message.message_id },
        });
      } catch (error) {
        loggers.errorWithContext(error as Error, 'Google Photos API');
        await ctx.reply('Error getting album info, please try again later');
      }
    } else {
      await ctx.reply('You must specify an album id!\n /albumInfo <album id>');
    }
  });

  privateBot.command('showexpenses', async (ctx) => {
    // Check if Sheet ID is set
    if (!process.env.ONBOARDING_SPREADSHEET_ID) {
      const response = 'Google Spreadsheet ID is not set. Please contact the administrator.';

      loggers.botResponse(ctx.from?.id || 0, response);
      await ctx.reply(response);

      return;
    }

    const data = await getSheetData();

    if (!data?.values || data.values.length === 0) {
      return [];
    }

    const message = formatExpenses(data.values as string[][]);

    loggers.botResponse(ctx.from?.id || 0, message || 'No expenses found.');
    await ctx.reply(message || 'No expenses found.', {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  privateBot.command('testdailymessage', async (ctx) => {
    // Check if user is an admin
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      const response = "You're not allowed to do that";

      loggers.botResponse(ctx.from?.id || 0, response);
      await ctx.reply(response);

      return;
    }

    try {
      await generateDailyMessage(bot, ctx.from.id, true);
    } catch (error) {
      loggers.errorWithContext(error as Error, '/testdailymessage');
      await ctx.reply(`Failed to generate daily message: ${(error as Error).message}`);
    }
  });

  // Show all users from the onboarding table
  privateBot.command('users', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("You're not allowed to do that");

      return;
    }

    const users = getAllUsers(db);

    if (users.length === 0) {
      await ctx.reply('No users found.');

      return;
    }

    const statusIcon: Record<string, string> = {
      COMPLETED: '✅',
      WAITING_PAYMENT: '💳',
      STARTED: '⏳',
    };

    const rows = users
      .map((u) => {
        const icon = statusIcon[u.onboarding_status ?? ''] ?? '❓';
        const name = escapeHtml(u.name ?? '—');
        const username = u.telegram_username ? ` (@${escapeHtml(u.telegram_username)})` : '';

        return `${icon} ${name}${username}`;
      })
      .join('\n');

    const legend = '✅ Completed  💳 Waiting payment  ⏳ Started  ❓ Unknown';
    const message = `<b>Users (${users.length})</b>\n${rows}\n\n${legend}`;

    await ctx.reply(message, { parse_mode: 'HTML' });
  });

  // Send festival-ended message to group and all completed users
  privateBot.command('offboarding1', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("You're not allowed to do that");

      return;
    }

    const groupChatId = process.env.GROUP_CHAT_ID;

    if (!groupChatId) {
      await ctx.reply('GROUP_CHAT_ID is not set.');

      return;
    }

    // Send group message
    try {
      const groupMessage = i18n.translate('pt', 'offboarding-festival-ended-group');

      await bot.api.sendMessage(groupChatId, groupMessage);
    } catch (error) {
      loggers.errorWithContext(error as Error, '/offboarding1 group message');
      await ctx.reply('Failed to send group message.');

      return;
    }

    // Send individual DMs to all completed users
    const users = getAllCompletedUsers(db);
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const locale = (user.preferred_language as 'en' | 'pt') ?? 'pt';
        const name = user.name ?? user.telegram_username ?? 'friend';
        const message = i18n.translate(locale, 'offboarding-festival-ended-private', { name });

        await bot.api.sendMessage(user.user_id, message);
        sent++;
      } catch (error) {
        loggers.errorWithContext(error as Error, `/offboarding1 DM to user ${user.user_id}`);
        failed++;
      }
    }

    const summary = i18n.translate('en', 'offboarding-admin-summary', { sent, failed });

    await ctx.reply(summary);
  });

  // Send individual balances and spreadsheet link for review period
  privateBot.command('offboarding2', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("You're not allowed to do that");

      return;
    }

    let balances: Map<number, number>;

    try {
      balances = await getOffboardingBalances();
    } catch (error) {
      loggers.errorWithContext(error as Error, '/offboarding2 sheet read');
      await ctx.reply(`Failed to read offboarding sheet: ${(error as Error).message}`);

      return;
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${process.env.OFFBOARDING_SPREADSHEET_ID}`;
    const deadline = new Date();

    deadline.setDate(deadline.getDate() + 7);

    const deadlineStr = deadline.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    let sent = 0;
    let failed = 0;

    for (const [userId, amount] of balances) {
      try {
        const user = getUserById(db, userId);
        const locale = (user?.preferred_language as 'en' | 'pt') ?? 'pt';
        const absAmount = Math.abs(amount).toFixed(2);

        const balanceKey =
          amount >= 0 ? 'offboarding-balance-positive' : 'offboarding-balance-negative';
        const balanceMessage = i18n.translate(locale, balanceKey, { amount: absAmount });
        const deadlineMessage = i18n.translate(locale, 'offboarding-review-deadline', {
          spreadsheetUrl,
          deadline: deadlineStr,
        });

        await bot.api.sendMessage(userId, `${balanceMessage}\n\n${deadlineMessage}`, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });
        sent++;
      } catch (error) {
        loggers.errorWithContext(error as Error, `/offboarding2 DM to user ${userId}`);
        failed++;
      }
    }

    const summary = i18n.translate('en', 'offboarding-admin-summary', { sent, failed });

    await ctx.reply(summary);
  });

  // Send final settlement instructions
  privateBot.command('offboarding3', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("You're not allowed to do that");

      return;
    }

    let balances: Map<number, number>;

    try {
      balances = await getOffboardingBalances();
    } catch (error) {
      loggers.errorWithContext(error as Error, '/offboarding3 sheet read');
      await ctx.reply(`Failed to read offboarding sheet: ${(error as Error).message}`);

      return;
    }

    const mbwayNumber = process.env.MBWAY_NUMBER ?? '';
    const iban = process.env.BANK_IBAN ?? '';
    let sent = 0;
    let failed = 0;

    for (const [userId, amount] of balances) {
      try {
        const user = getUserById(db, userId);
        const locale = (user?.preferred_language as 'en' | 'pt') ?? 'pt';
        const absAmount = Math.abs(amount).toFixed(2);
        const owesMoney = amount < 0;

        if (owesMoney) {
          const message = i18n.translate(locale, 'offboarding-final-pay', {
            amount: absAmount,
            mbwayNumber,
            iban,
          });
          const revolutUrl = buildRevolutPaymentLink(
            user?.name ?? '',
            Number(absAmount),
            'PDC_2026_Settlement',
          );
          const paypalUrl = buildPaypalPaymentLink(
            process.env.PAYPAL_ME_USERNAME ?? '',
            Number(absAmount),
          );
          const paymentKeyboard = new InlineKeyboard()
            .url(i18n.translate(locale, 'onboarding-btn-pay-revolut'), revolutUrl)
            .url(i18n.translate(locale, 'offboarding-btn-pay-paypal'), paypalUrl);

          await bot.api.sendMessage(userId, message, {
            parse_mode: 'HTML',
            reply_markup: paymentKeyboard,
          });
        } else {
          const message = i18n.translate(locale, 'offboarding-final-receive', {
            amount: absAmount,
            mbwayNumber,
          });

          await bot.api.sendMessage(userId, message, { parse_mode: 'HTML' });
        }

        sent++;
      } catch (error) {
        loggers.errorWithContext(error as Error, `/offboarding3 DM to user ${userId}`);
        failed++;
      }
    }

    const summary = i18n.translate('en', 'offboarding-admin-summary', { sent, failed });

    await ctx.reply(summary);
  });

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
        await bot.api.sendMessage(userId, messageText);
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

  // Prompt for and wait for the broadcast message, then preview + confirm/cancel
  privateBot.command('announce', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply("You're not allowed to do that");

      return;
    }

    await ctx.conversation.enter('announceConversation');
  });

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
      await bot.api.sendMessage(config.groupChatId, pendingBroadcast);
    } catch (error) {
      loggers.errorWithContext(error as Error, '/announce group send');
      ctx.session.pendingBroadcast = undefined;
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('❌ Failed to send the broadcast. Please try /announce again.');

      return;
    }

    ctx.session.pendingBroadcast = undefined;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('✅ Sent to the group.');
    loggers.botResponse(ctx.from.id, `Broadcast sent: ${pendingBroadcast}`);
  });

  bot.callbackQuery('announce_confirm_pin', async (ctx) => {
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

    let messageId: number;

    try {
      const sent = await bot.api.sendMessage(config.groupChatId, pendingBroadcast);

      messageId = sent.message_id;
    } catch (error) {
      loggers.errorWithContext(error as Error, '/announce group send');
      ctx.session.pendingBroadcast = undefined;
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('❌ Failed to send the broadcast. Please try /announce again.');

      return;
    }

    ctx.session.pendingBroadcast = undefined;
    ctx.session.pendingPinMessageId = messageId;

    const pinKeyboard = new InlineKeyboard()
      .text('🔔 Notify', 'announce_pin_notify')
      .text('🔕 Silent', 'announce_pin_silent');

    await ctx.answerCallbackQuery();
    await ctx.editMessageText('✅ Sent to the group.\n\nPin this message?', {
      reply_markup: pinKeyboard,
    });
  });

  bot.callbackQuery('announce_pin_notify', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCallbackQuery("You're not allowed to do that");

      return;
    }

    const pendingPinMessageId = ctx.session.pendingPinMessageId;

    if (!pendingPinMessageId) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('Nothing pending — this pin decision was already made.');

      return;
    }

    try {
      await bot.api.pinChatMessage(config.groupChatId, pendingPinMessageId, {
        disable_notification: false,
      });
    } catch (error) {
      loggers.errorWithContext(error as Error, '/announce group pin');
      ctx.session.pendingPinMessageId = undefined;
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('✅ Sent to the group (pin failed — check bot permissions).');

      return;
    }

    ctx.session.pendingPinMessageId = undefined;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('✅ Sent to the group and pinned.');
    loggers.botResponse(ctx.from.id, 'Broadcast pinned');
  });

  bot.callbackQuery('announce_pin_silent', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCallbackQuery("You're not allowed to do that");

      return;
    }

    const pendingPinMessageId = ctx.session.pendingPinMessageId;

    if (!pendingPinMessageId) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('Nothing pending — this pin decision was already made.');

      return;
    }

    try {
      await bot.api.pinChatMessage(config.groupChatId, pendingPinMessageId, {
        disable_notification: true,
      });
    } catch (error) {
      loggers.errorWithContext(error as Error, '/announce group pin');
      ctx.session.pendingPinMessageId = undefined;
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('✅ Sent to the group (pin failed — check bot permissions).');

      return;
    }

    ctx.session.pendingPinMessageId = undefined;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('✅ Sent to the group and pinned.');
    loggers.botResponse(ctx.from.id, 'Broadcast pinned');
  });

  bot.callbackQuery('announce_cancel', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCallbackQuery("You're not allowed to do that");

      return;
    }

    ctx.session.pendingBroadcast = undefined;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('❌ Cancelled.');
  });
};

export default botAdminCommands;
