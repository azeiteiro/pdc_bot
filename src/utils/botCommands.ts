import { Markup, Telegraf, Context } from 'telegraf';
import googlePhotosAPI from './googlePhotosAPI';
import logger from './logger';
import utils from './utils';

const botCommands = (bot: Telegraf) => {
  const { getAlbums, createAlbum } = googlePhotosAPI();
  const { saveFile, getDays, getLineup, getInfoMessage } = utils();

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
        disable_web_page_preview: true,
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
    if (!process.env.ADMIN_IDS.includes(ctx.from.id)) {
      ctx.reply("You're not allowed to do that");

      return;
    }

    const albumName = ctx.message.text.replace('/createAlbum ', '');

    if (albumName === '') {
      ctx.reply('You must specify an album name!\n /createAlbum <album name>');

      return;
    }

    ctx.reply('Creating the album, please wait').then((message) => {
      createAlbum(albumName).then((albumStatus) => {
        ctx.reply(albumStatus, { reply_to_message_id: message.message_id });
      });
    });
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
      'This bot allows you to see the schedule for the PDC 2022 festival. Use /help to see more.',
    );
  });

  // Log messages
  bot.on('message', (ctx) => {
    logger.log('userChat', ctx.message);
  });
};

export default botCommands;
