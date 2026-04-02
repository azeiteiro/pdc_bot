import { Bot } from 'grammy';
import type { BotContext } from '../types/types.js';
import { createAlbum, getAlbumInfo, getAlbums } from '../googleApi/googlePhotosAPI.js';
import { loggers } from '../utils/logger.js';
import { getSheetData } from '../googleApi/googleSheetsApi.js';
import { formatExpenses } from '../utils/formatters.js';
import { generateDailyMessage } from '../utils/utils.js';

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

const botAdminCommands = (bot: Bot<BotContext>) => {
  // Create a new album in Google Photos
  bot.command('createAlbum', (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      const response = "You're not allowed to do that";

      ctx.reply(response);
      loggers.botResponse(ctx.from?.id || 0, response);

      return;
    }

    const commandPattern = /^\/createAlbum\s+(.+)$/;
    const userMessage = ctx.message?.text || '';

    if (commandPattern.test(userMessage)) {
      const parts = userMessage.split('/createAlbum ');
      const albumName = parts[1].trim();

      ctx.reply('Creating the album, please wait').then(() => {
        createAlbum(albumName).then((albumStatus) => {
          ctx.reply(albumStatus);
          loggers.botResponse(ctx.from!.id, albumStatus);
        });
      });
    } else {
      ctx.reply('You must specify an album name!\n /createAlbum <album name>');
    }
  });

  // List Google Photos albums
  bot.command('albums', (ctx) => {
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

  bot.command('albumInfo', (ctx) => {
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

  bot.command('showexpenses', async (ctx) => {
    // Check if Sheet ID is set
    if (!process.env.GOOGLE_SPREADSHEET_ID) {
      const response = 'Google Spreadsheet ID is not set. Please contact the administrator.';

      loggers.botResponse(ctx.from?.id || 0, response);
      ctx.reply(response);

      return;
    }

    // Check if user is an admin
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      const response = "You're not allowed to do that";

      loggers.botResponse(ctx.from?.id || 0, response);
      ctx.reply(response);

      return;
    }

    const data = await getSheetData();

    if (!data?.values || data.values.length === 0) {
      return [];
    }

    const message = formatExpenses(data.values as string[][]);

    loggers.botResponse(ctx.from.id, message || 'No expenses found.');
    ctx.reply(message || 'No expenses found.', {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  bot.command('testdailymessage', async (ctx) => {
    // Check if user is an admin
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      const response = "You're not allowed to do that";

      loggers.botResponse(ctx.from?.id || 0, response);
      ctx.reply(response);

      return;
    }

    generateDailyMessage(bot, ctx.from.id, true);
  });
};

export default botAdminCommands;
