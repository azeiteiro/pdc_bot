import axios from 'axios';
import { readFileSync, createWriteStream, mkdir, access } from 'fs';
import schedule from 'node-schedule';
import { Context, Telegraf, Markup } from 'telegraf';
import { cwd } from 'process';
import googlePhotosAPI from './googlePhotosAPI';
import logger from './logger';
import { FestivalData, Command } from './types';

export default () => {
  // Creates /downloads/photos, regardless of whether `/downloads` and /downloads/photos exist.
  access('/downloads/photos', (error) => {
    if (error) {
      mkdir(`${cwd()}/downloads/photos`, { recursive: true }, (err) => {
        if (err) {
          throw err;
        }
      });
    }
  });

  const getJsonData = (fileName: string): FestivalData | Array<Command> =>
    JSON.parse(readFileSync(`${__dirname}/../resources/${fileName}.json`, 'utf8'));

  const concertData = getJsonData('pdc_2019') as FestivalData;

  const subscribeAlerts = (bot: Telegraf, chatId: number) => {
    // Alert time delay in minutes
    const alertTimeDelay = 30;

    Object.keys(concertData).forEach((day) => {
      const dayData = concertData[day];

      dayData.forEach((c) => {
        const text =
          `There will be a concert in ${alertTimeDelay} minutes:\n\n<b>${c.name}</b>\n\n` +
          `<i>Starts at </i><b>${c.hour}</b><i> in </i><b>${c.stage}</b>\n`;

        // Format date and time
        const tempDate = c.day.split('/');
        const announceTime = new Date(`${tempDate[2]}-${tempDate[1]}-${tempDate[0]} ${c.hour}`);

        announceTime.setMinutes(announceTime.getMinutes() - alertTimeDelay);

        schedule.scheduleJob(announceTime, () => {
          bot.telegram.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: Markup.inlineKeyboard([Markup.button.url('view more info', c.url)])
              .reply_markup,
          });
        });
      });
    });
  };

  const saveFile = (fileId: string, fileExtension: string, ctx: Context) => {
    const { savePhoto } = googlePhotosAPI();
    const filePath = `${cwd()}/downloads/photos/${fileId}.${fileExtension}`;

    ctx.telegram.getFileLink(fileId).then((url) =>
      axios
        .get(url.toString(), { responseType: 'stream' })
        .then((response) =>
          response.data.pipe(createWriteStream(filePath)).on('finish', () => {
            if (process.env.UPLOAD_TO_GPHOTOS === true) {
              savePhoto(process.env.ALBUM_ID, filePath);
            }
          }),
        )
        .catch((error) => {
          logger.error(error);
        }),
    );
  };

  const getLineup = (weekDay: string): string => {
    const response = `<b>Line-up for ${weekDay[0].toUpperCase()}${weekDay.slice(1)}</b>\n`;

    return `${response}\n${concertData[weekDay]
      .map((concert) => `<i>${concert.hour}</i>: <b>${concert.name}</b> - ${concert.stage}\n`)
      .join('')}`;
  };

  const getDays = (): string[] => Object.keys(concertData);

  return { subscribeAlerts, getLineup, saveFile, getDays, getJsonData };
};
