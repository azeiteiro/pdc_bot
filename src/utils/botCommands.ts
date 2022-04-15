import { Markup, Telegraf, Context } from 'telegraf';
import googlePhotosAPI from './googlePhotosAPI';
import utils from './utils';

const botCommands = (bot: Telegraf) => {
  const { getAlbums, createAlbum } = googlePhotosAPI();
  const { saveFile, getDays } = utils();

  // Get the lineup for a specific day
  bot.command('lineup', (ctx) => {
    ctx.reply(
      'Please select the day',
      Markup.keyboard(getDays(), { columns: 2 }).oneTime().placeholder('Select').resize(),
    );
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
    // Telegram stores multiple images size, last one is the bigger
    const fileExtension = (file.file_name?.match(/\.([^.]*?)(?=\?|#|$)/) || [])[1];
    const fileId = file.file_id;

    // Proceed downloading
    saveFile(fileId, fileExtension, ctx as Context);
  });

  bot.on('callback_query', (ctx) => {
    // Explicit usage
    ctx.telegram.answerCbQuery(ctx.callbackQuery.id);

    // Using context shortcut
    ctx.answerCbQuery();
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
    createAlbum('cenas');

    ctx.reply('Album created');
  });
};

export default botCommands;
