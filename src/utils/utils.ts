import axios from 'axios';
import { readFileSync, createWriteStream, mkdir, access } from 'fs';
import schedule from 'node-schedule';
import { Context, Telegraf, Markup } from 'telegraf';
import { cwd } from 'process';
import googlePhotosAPI from './googlePhotosAPI';
import logger from './logger';
import { FestivalData, Command, Forecast } from '../types/types';

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

  const concertData = getJsonData('lineup') as FestivalData;

  const subscribeAlerts = (bot: Telegraf, chatId: number) => {
    // Alert time delay in minutes
    const alertTimeDelay = 30;

    Object.keys(concertData).forEach((day) => {
      const dayData = concertData[day];

      dayData.forEach((c) => {
        const text =
          `There will be a concert in ${alertTimeDelay} minutes:\n\n<b>${c.name}</b>\n\n` +
          `<i>Starts at </i><b>${c.hour}</b><i> in </i><b>${c.stage}</b>\n`;

        const announceTime = new Date(`${day} ${c.hour}`);

        announceTime.setDate(c.day);

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
    const response = `<b>Line-up for ${new Date(weekDay).toLocaleString('default', {
      weekday: 'long',
    })}</b>\n`;

    if (!(weekDay in concertData)) {
      return '';
    }

    return `${response}\n${concertData[weekDay]
      .map((concert) => `<i>${concert.hour}</i>: <b>${concert.name}</b> - ${concert.stage}\n`)
      .join('')}`;
  };

  const getDays = (): string[] => Object.keys(concertData);

  const getDailyMessageText = (weather: Forecast, day: string) =>
    `Olá amigos! 👋\n\n` +
    `Espero que tenham tido uma boa noite, vamos lá preparar este dia que aí vem.\n\n` +
    `Hoje é ${new Date(day).toLocaleDateString('pt-PT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}\n\n` +
    `As <a href="${weather.MobileLink}">temperaturas em Paredes de Coura</a> variam entre os ↘️ <b>${weather.Temperature.Minimum.Value}ºC</b> e os <b>${weather.Temperature.Maximum.Value}ºC</b> ↗️\n\n` +
    `Temos um dia ${weather.Day.IconPhrase.toLocaleLowerCase()}` +
    `<b>${weather.Day.HasPrecipitation ? ' com' : ' sem'}</b> chuva\n` +
    ` e uma noite ${weather.Night.IconPhrase.toLocaleLowerCase()}` +
    `<b>${weather.Night.HasPrecipitation ? ' com' : ' sem'}</b> chuva\n\n` +
    `Um bem-haja e tudo de bom! ❤️`;

  const generateDailyMessage = (ctx: Context) =>
    axios
      .get('http://dataservice.accuweather.com/forecasts/v1/daily/1day/276252', {
        params: {
          apikey: process.env.ACCUWEATHER_API_KEY,
          language: 'pt-pt',
          details: false,
          metric: true,
        },
      })
      .then((response) => {
        const day = new Date().toJSON().slice(0, 10);

        ctx
          .replyWithHTML(getDailyMessageText(response.data.DailyForecasts[0], day), {
            disable_web_page_preview: true,
          })
          .then(() => {
            const lineUp = getLineup(day);

            if (lineUp !== '') {
              ctx.replyWithHTML(lineUp).then((message) => {
                ctx.unpinAllChatMessages().then(() => ctx.pinChatMessage(message.message_id));
              });
            }
          });
      })
      .catch((error) => {
        logger.error(error);

        return error;
      });

  const getInfoMessage = (ctx: Context) => {
    const { getAlbumInfo } = googlePhotosAPI();

    getAlbumInfo(process.env.ALBUM_ID).then((album) =>
      ctx.replyWithHTML(
        `<b>Links úteis:</b>\n\n📷 Álbum Google Photos: <a href="${album.productUrl}">${album.title}</a>\n\nℹ️ Folha com contas e outras informações: <a href="https://docs.google.com/spreadsheets/d/1TMC-L1lfwczN5GihYv2Nm48DrS0kuGJ3iTspW8NpYUE/edit#gid=429680491">Pré-Festival Paredes de Coura 2022</a>`,
        {
          disable_web_page_preview: true,
        },
      ),
    );
  };

  return {
    subscribeAlerts,
    getLineup,
    saveFile,
    getDays,
    getJsonData,
    generateDailyMessage,
    getInfoMessage,
  };
};
