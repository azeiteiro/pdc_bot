import { Markup, Telegraf, Context } from 'telegraf';
import { createAlbum, getAlbumInfo, getAlbums } from './googlePhotosAPI.js';
import logger from './logger.js';
import { getDays, getInfoMessage, getLineup, saveFile } from './utils.js';
import { getSheetData } from './sheetsApi.js';
import { BotContext } from '../types/types.js';
import { addExpenseFlowScene } from '../scenes/addExpenseScene.js';

const botCommands = (bot: Telegraf<BotContext>) => {
  // Get the lineup for a specific day
  bot.command('lineup', (ctx) => {
    ctx.reply(
      'Please select the day',
      Markup.inlineKeyboard(
        getDays().map((day: string) =>
          Markup.button.callback(
            `${new Date(day).toLocaleString('en-GB', { weekday: 'long', day: '2-digit' })}`,
            `lineup-${day}`,
          ),
        ),
        {
          wrap: (btn, index) => index % 3 === 0,
        },
      ),
    );
    logger.log('userChat', ctx.message);
  });

  // Listen for button clicks on lineup command
  bot.action(/^(lineup-)\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/gm, (ctx) => {
    try {
      ctx.replyWithHTML(getLineup(ctx.match[0].replace('lineup-', '')), {
        link_preview_options: { is_disabled: true },
      });
      logger.log('userChat', ctx.match);
    } catch (e) {
      logger.error(e);
      ctx.reply('Unknow error, please try again later');
    }
  });

  bot.on('video_note', (ctx) => {
    const file = ctx.update.message.video_note;
    const fileExtension = 'mp4';
    const fileId = file.file_id;

    saveFile(fileId, fileExtension, ctx as Context);
  });

  bot.on('photo', (ctx) => {
    const files = ctx.update.message.photo;

    // Telegram stores multiple images size, last one is the bigger
    const fileId = files[files.length - 1].file_id;

    // Proceed downloading
    saveFile(fileId, 'jpg', ctx as Context);
  });

  bot.on('video', (ctx) => {
    const file = ctx.update.message.video;
    const fileExtension = (file.file_name?.match(/\.([^.]*?)(?=\?|#|$)/) || [])[1];
    const fileId = file.file_id;

    // Proceed downloading
    saveFile(fileId, fileExtension, ctx as Context);
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
      logger.log('userChat', ctx.message);
    });
  });

  // Create a new album
  bot.command('createAlbum', (ctx) => {
    if (!process.env.ADMIN_IDS.includes(String(ctx.from.id))) {
      ctx.reply("You're not allowed to do that");

      return;
    }

    const commandPattern = /^\/createAlbum\s+(.+)$/;
    const userMessage = ctx.message.text;

    if (commandPattern.test(userMessage)) {
      const parts = userMessage.split('/createAlbum ');
      const albumName = parts[1].trim();

      console.log('albumName', albumName);

      ctx.reply('Creating the album, please wait').then(() => {
        createAlbum(albumName).then((albumStatus) => {
          ctx.reply(albumStatus);
        });
      });
    } else {
      ctx.reply('You must specify an album name!\n /createAlbum <album name>');
    }
  });

  bot.command('albumInfo', (ctx) => {
    const commandPattern = /^\/albumInfo\s+\S+$/;
    const userMessage = ctx.message.text;

    if (commandPattern.test(userMessage)) {
      const albumId = userMessage.split(' ')[1];

      ctx.reply('Getting album info, please wait').then((message) => {
        getAlbumInfo(albumId).then((albumInfo) => {
          ctx.reply(`Title: ${albumInfo.title} - ${albumInfo.productUrl}`, {
            message_thread_id: message.message_id,
          });
        });
      });
    } else {
      ctx.reply('You must specify an album id!\n /albumInfo <album id>');
    }
  });

  bot.command('info', (ctx) => getInfoMessage(ctx));

  bot.command('help', (ctx) => {
    bot.telegram.getMyCommands().then((commands) => {
      const info = commands.reduce(
        (acc, val) => `${acc}/${val.command} - ${val.description}\n`,
        '',
      );

      ctx.reply(info);
    });
  });

  bot.command('about', (ctx) => {
    ctx.reply(
      'This bot allows you to see the schedule for the PDC 2024 festival. Use /help to see more.',
    );
  });

  bot.command('expense', async (ctx) => {
    // Check if Sheet ID is set
    if (!process.env.GOOGLE_SPREADSHEET_ID) {
      ctx.reply('Google Spreadsheet ID is not set. Please contact the administrator.');

      return;
    }
    addExpenseFlowScene(ctx);
  });

  bot.command('showexpenses', async (ctx) => {
    // Check if Sheet ID is set
    if (!process.env.GOOGLE_SPREADSHEET_ID) {
      ctx.reply('Google Spreadsheet ID is not set. Please contact the administrator.');

      return;
    }

    if (!process.env.ADMIN_IDS.includes(String(ctx.from.id))) {
      ctx.reply("You're not allowed to do that");

      return;
    }

    const data = await getSheetData();

    if (!data?.values || data.values.length === 0) {
      return [];
    }

    const result = data.values as string[][];

    const message = result
      .filter((row) => row[0] !== undefined && row[0] !== '')
      .map((row) => `<b>${row[0]}</b> | <i>${row[1]}</i> | <code>${row[2]}</code> | ${row[3]}`)
      .join('\n');

    ctx.replyWithHTML(message || 'No expenses found.', {
      link_preview_options: { is_disabled: true },
    });
  });

  // Log messages
  bot.on('message', (ctx) => {
    console.log('userChat', ctx.message);
    logger.log('userChat', ctx.message);
  });
};

export default botCommands;
