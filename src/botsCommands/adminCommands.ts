import { Telegraf } from 'telegraf';
import type { BotContext } from '../types/types.js';
import { createAlbum, getAlbumInfo, getAlbums } from '../googleApi/googlePhotosAPI.js';
import { loggers } from '../utils/logger.js';
import { getSheetData } from '../googleApi/googleSheetsApi.js';
import { formatExpenses } from '../utils/formatters.js';
import { generateDailyMessage } from '../utils/utils.js';

const botAdminCommands = (bot: Telegraf<BotContext>) => {
  // Create a new album in Google Photos
  bot.command('createAlbum', (ctx) => {
    if (!process.env.ADMIN_IDS.includes(String(ctx.from.id))) {
      const response = "You're not allowed to do that";

      ctx.reply(response);
      loggers.botResponse(ctx.from.id, response);

      return;
    }

    const commandPattern = /^\/createAlbum\s+(.+)$/;
    const userMessage = ctx.message.text;

    if (commandPattern.test(userMessage)) {
      const parts = userMessage.split('/createAlbum ');
      const albumName = parts[1].trim();

      ctx.reply('Creating the album, please wait').then(() => {
        createAlbum(albumName).then((albumStatus) => {
          ctx.reply(albumStatus);
          loggers.botResponse(ctx.from.id, albumStatus);
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
      loggers.botResponse(ctx.from.id, response);
    });
  });

  bot.command('albumInfo', (ctx) => {
    const commandPattern = /^\/albumInfo\s+\S+$/;
    const userMessage = ctx.message.text;

    if (commandPattern.test(userMessage)) {
      const albumId = userMessage.split(' ')[1];

      ctx.reply('Getting album info, please wait').then((message) => {
        getAlbumInfo(albumId)
          .then((albumInfo) => {
            ctx.reply(`Title: ${albumInfo.title} - ${albumInfo.productUrl}`, {
              message_thread_id: message.message_id,
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

      loggers.botResponse(ctx.from.id, response);
      ctx.reply(response);

      return;
    }

    // Check if user is an admin
    if (!process.env.ADMIN_IDS.includes(String(ctx.from.id))) {
      const response = "You're not allowed to do that";

      loggers.botResponse(ctx.from.id, response);
      ctx.reply(response);

      return;
    }

    const data = await getSheetData();

    if (!data?.values || data.values.length === 0) {
      return [];
    }

    const message = formatExpenses(data.values as string[][]);

    loggers.botResponse(ctx.from.id, message || 'No expenses found.');
    ctx.replyWithHTML(message || 'No expenses found.', {
      link_preview_options: { is_disabled: true },
    });
  });

  bot.command('testdailymessage', async (ctx) => {
    // Check if user is an admin
    if (!process.env.ADMIN_IDS.includes(String(ctx.from.id))) {
      const response = "You're not allowed to do that";

      loggers.botResponse(ctx.from.id, response);
      ctx.reply(response);

      return;
    }

    generateDailyMessage(bot, ctx.from.id, true);
  });
};

export default botAdminCommands;
