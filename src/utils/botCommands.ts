import { Markup, Telegraf, Context } from 'telegraf';
import googlePhotosAPI from './googlePhotosAPI';
import utils from './utils';

const botCommands = (bot: Telegraf) => {
  const { saveFile } = utils();

  // Get the lineup for a specific day
  bot.command('lineup', (ctx) => {
    ctx.reply(
      'Please select the day',
      Markup.keyboard(['/simple', '/inline', '/pyramid']).oneTime().resize(),
    );
  });

  bot.on('photo', (ctx) => {
    const files = ctx.update.message.photo;
    // Telegram stores multiple images size, last one is the bigger
    const fileId = files[files.length - 1].file_id;

    // Proceed downloading
    saveFile(fileId, ctx as Context);
  });

  // List Google Photos albums
  bot.command('albums', (ctx) => {
    const { getAlbuns } = googlePhotosAPI();

    const albums = getAlbuns();

    let response = '';

    albums.then((p) => {
      p.forEach((album) => {
        response += `${album.title}\n`;
      });

      ctx.reply(response);
    });
  });
};

export default botCommands;
