import { readFileSync } from 'fs';
import { getResourcePath } from '../utils/dataLoader.js';
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
  privateBot.command('create_album', (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      const response = "You're not allowed to do that";

      ctx.reply(response);
      loggers.botResponse(ctx.from?.id || 0, response);

      return;
    }
    console.log('Received createAlbum command from user:', ctx.from.id);

    const commandPattern = /^\/create_album\s+(.+)$/;
    const userMessage = ctx.message?.text || '';

    if (commandPattern.test(userMessage)) {
      const parts = userMessage.split('/create_album ');
      const albumName = parts[1].trim();

      ctx.reply('Creating the album, please wait').then(() => {
        createAlbum(albumName).then((albumStatus) => {
          ctx.reply(albumStatus);
          loggers.botResponse(ctx.from!.id, albumStatus);
        });
      });
    } else {
      ctx.reply('You must specify an album name!\n /create_album <album name>');
    }
  });

  // List Google Photos albums
  privateBot.command('albums', (ctx) => {
    const albums = getAlbums();

    let response = '';

    albums.then((p) => {
      p.forEach((album) => {
        response += `${album.title}\n`;
      });

      ctx.reply(response);
      loggers.botResponse(ctx.from?.id || 0, response);
    });
  });

  privateBot.command('albumInfo', (ctx) => {
    const commandPattern = /^\/albumInfo\s+\S+$/;
    const userMessage = ctx.message?.text || '';

    if (commandPattern.test(userMessage)) {
      const albumId = userMessage.split(' ')[1];

      ctx.reply('Getting album info, please wait').then((message: unknown) => {
        getAlbumInfo(albumId)
          .then((albumInfo) => {
            ctx.reply(`Title: ${albumInfo.title} - ${albumInfo.productUrl}`, {
              reply_parameters: { message_id: (message as { message_id: number }).message_id },
            });
          })
          .catch((error) => {
            loggers.errorWithContext(error as Error, 'Google Photos API');
            ctx.reply('Error getting album info, please try again later');
          });
      });
    } else {
      ctx.reply('You must specify an album id!\n /albumInfo <album id>');
    }
  });

  privateBot.command('showexpenses', async (ctx) => {
    // Check if Sheet ID is set
    if (!process.env.ONBOARDING_SPREADSHEET_ID) {
      const response = 'Google Spreadsheet ID is not set. Please contact the administrator.';

      loggers.botResponse(ctx.from?.id || 0, response);
      ctx.reply(response);

      return;
    }

    const data = await getSheetData();

    if (!data?.values || data.values.length === 0) {
      return [];
    }

    const message = formatExpenses(data.values as string[][]);

    loggers.botResponse(ctx.from?.id || 0, message || 'No expenses found.');
    ctx.reply(message || 'No expenses found.', {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  privateBot.command('testdailymessage', async (ctx) => {
    // Check if user is an admin
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      const response = "You're not allowed to do that";

      loggers.botResponse(ctx.from?.id || 0, response);
      ctx.reply(response);

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
      ctx.reply("You're not allowed to do that");

      return;
    }

    const users = getAllUsers(db);

    if (users.length === 0) {
      ctx.reply('No users found.');

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
        const name = u.name ?? '—';
        const username = u.telegram_username ? `@${u.telegram_username}` : '—';

        return `<tr><td>${icon}</td><td>${name}</td><td>${username}</td></tr>`;
      })
      .join('');

    const legend = `<ul><li>✅ Completed</li><li>💳 Waiting payment</li><li>⏳ Started</li><li>❓ Unknown</li></ul>`;
    const html = `<h3>Users (${users.length})</h3><table><tr><th>Status</th><th>Name</th><th>Username</th></tr>${rows}</table>${legend}`;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx.api.raw as any).sendRichMessage({
        chat_id: ctx.chat!.id,
        rich_message: { html },
      });
    } catch (error) {
      loggers.errorWithContext(error as Error, '/users');
      ctx.reply(`Error: ${(error as Error).message}`);
    }
  });

  // Send festival-ended message to group and all completed users
  privateBot.command('offboarding1', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      ctx.reply("You're not allowed to do that");

      return;
    }

    const groupChatId = process.env.GROUP_CHAT_ID;

    if (!groupChatId) {
      ctx.reply('GROUP_CHAT_ID is not set.');

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
      ctx.reply("You're not allowed to do that");

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
      ctx.reply("You're not allowed to do that");

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

  // Temporary command to test Telegram rich text HTML formatting
  privateBot.command('textformat', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      ctx.reply("You're not allowed to do that");

      return;
    }

    try {
      const html = readFileSync(getResourcePath('test.html'), 'utf-8');

      // TODO: replace cast once grammY adds sendRichMessage typings (Bot API 10.1)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx.api.raw as any).sendRichMessage({
        chat_id: ctx.chat!.id,
        rich_message: { html },
      });
    } catch (error) {
      loggers.errorWithContext(error as Error, '/textformat2');
      ctx.reply(`Error: ${(error as Error).message}`);
    }
  });
};

export default botAdminCommands;
