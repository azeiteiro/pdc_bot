import { Markup, Telegraf, Context } from 'telegraf';
import googlePhotosAPI from './googlePhotosAPI';
import logger from './logger';
import utils from './utils';

const botCommands = (bot: Telegraf) => {
  const { getAlbums, createAlbum } = googlePhotosAPI();
  const { saveFile, getDays, getLineup } = utils();

  // Get the lineup for a specific day
  bot.command('lineup', (ctx) => {
    ctx.reply(
      'Please select the day',
      Markup.inlineKeyboard(
        getDays().map((day) =>
          Markup.button.callback(`${day[0].toUpperCase()}${day.slice(1)}`, `lineup-${day}`),
        ),
      ),
    );
  });

  // Listen for button clicks on lineup command
  bot.action(/^(lineup-)[a-z]+$/gm, (ctx) => {
    try {
      ctx.replyWithHTML(getLineup(ctx.match[0].split('-')[1]));
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
};

export default botCommands;
