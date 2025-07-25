import axios from 'axios';
import { createWriteStream, mkdir, access } from 'fs';
import schedule from 'node-schedule';
import { Context, Telegraf, Markup } from 'telegraf';
import { cwd } from 'process';
import { savePhoto } from './googlePhotosAPI.js';
import logger from './logger.js';
import jsonFestivalData from '../resources/lineup.json' with { type: 'json' };
import type { BotContext, FestivalData, Forecast } from '../types/types';

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

const concertData = jsonFestivalData as FestivalData;

export const subscribeAlerts = (bot: Telegraf<BotContext>) => {
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
        bot.telegram.sendMessage(process.env.CHAT_ID, text, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: Markup.inlineKeyboard([Markup.button.url('view more info', c.url)])
            .reply_markup,
        });
      });
    });
  });
};

export const saveFile = (fileId: string, fileExtension: string, ctx: Context) => {
  const filePath = `${cwd()}/downloads/photos/${fileId}.${fileExtension}`;

  ctx.telegram.getFileLink(fileId).then((url) =>
    axios
      .get(url.toString(), { responseType: 'stream' })
      .then((response) =>
        response.data.pipe(createWriteStream(filePath)).on('finish', () => {
          if (`${process.env.UPLOAD_TO_GPHOTOS}` === 'true') {
            savePhoto(process.env.ALBUM_ID, filePath);
          }
        }),
      )
      .catch((error) => {
        logger.error(error);
      }),
  );
};

export const getLineup = (weekDay: string): string => {
  const response = `<b>Line-up for ${new Date(weekDay).toLocaleString('en-GB', {
    weekday: 'long',
    day: '2-digit',
  })}</b>\n`;

  if (!(weekDay in concertData)) {
    return '';
  }

  return `${response}\n${concertData[weekDay]
    .map(
      (concert) =>
        `<i>${concert.hour}</i>: <b><a href="${concert.url}">${concert.name}</a></b> - ${concert.stage}\n`,
    )
    .join('')}`;
};

export const getDays = (): string[] => Object.keys(concertData);

export const getDailyMessageText = (weather: Forecast, day: string) =>
  `Olá amigos! 👋\n\n` +
  `Espero que tenham tido uma boa noite.\n\n` +
  `Hoje é ${new Date(day).toLocaleDateString('pt-PT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}\n\n` +
  `As <a href="${weather.MobileLink}">temperaturas em Paredes de Coura</a> variam entre os ↘️ <b>${weather.Temperature.Minimum.Value}ºC</b> e os <b>${weather.Temperature.Maximum.Value}ºC</b> ↗️\n\n` +
  `Temos um dia ${weather.Day.IconPhrase.toLocaleLowerCase()}` +
  `<b>${weather.Day.HasPrecipitation ? ' com' : ' sem'}</b> chuva\n` +
  ` e uma noite com tempo ${weather.Night.IconPhrase.toLocaleLowerCase()}` +
  `<b>${weather.Night.HasPrecipitation ? ' com' : ' sem'}</b> chuva\n\n` +
  `Um bem-haja e tudo de bom! ❤️`;

export const generateDailyMessage = (bot: Telegraf, chatId: number) =>
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

      bot.telegram
        .sendMessage(chatId, getDailyMessageText(response.data.DailyForecasts[0], day), {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        })
        .then(() => {
          const lineUp = getLineup(day);

          if (lineUp !== '') {
            bot.telegram
              .sendMessage(chatId, lineUp, {
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true },
              })
              .then((message) => {
                bot.telegram
                  .unpinAllChatMessages(chatId)
                  .then(() => bot.telegram.pinChatMessage(chatId, message.message_id));
              });
          }
        });
    })
    .catch((error) => {
      logger.error(error);

      return error;
    });

export const getInfoMessage = (ctx: Context) => {
  ctx
    .replyWithHTML(
      `<b>Useful links:</b>\n\n📷 Google Photos Album : <a href="${process.env.ALBUM_URL}">🏳️‍🌈 Paredes de Coura 2024</a>\n\nℹ️ Pré-Festival Spreadsheet: <a href="https://docs.google.com/spreadsheets/d/1SOmUdhoemgQ8rXsQ51SStqv5t2aSzjY0S5l23BySJNA/edit?usp=sharing">Pré-Festival Paredes de Coura 2024</a>`,
      {
        link_preview_options: { is_disabled: true },
      },
    )
    .then(() => logger.log('userChat', ctx.message));
};

export const scheduleDailyMessage = (bot: Telegraf) => {
  schedule.scheduleJob('0 0 9 * * *', () => {
    generateDailyMessage(bot, Number(process.env.CHAT_ID));
  });
};

export const addExpenseFlow = (ctx: Context) => {
  Markup.removeKeyboard();

  ctx
    .reply('Please provide a description for the expense, e.g., "Lunch at festival"')
    .then(() => {
      ctx.reply('Please provide the value of the expense, e.g., "10.50"');
    })
    .then(() => {
      ctx.reply(
        'I have the following information about you:\n' +
          `Name: ${ctx.from ? `${ctx.from.first_name ?? ''} ${ctx.from.last_name ?? ''}` : 'Unknown'}\n`,
      );
    });
  ctx
    .reply(
      'Please confirm the information below by selecting an option from the keyboard:',
      Markup.keyboard([
        ['📝 Edit description', '👤 Edit name'],
        ['💲 Edit value', '📅 Edit date'],
        ['✅ Accept'],
      ])
        .oneTime()
        .resize(),
    )
    .then(() => {
      ctx.reply('Please select an option from the keyboard.');
    });
};
