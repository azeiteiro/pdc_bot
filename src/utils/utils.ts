import { fetchStream, fetchJSON } from './http.js';
import { Readable } from 'stream';
import { createWriteStream, mkdir, access } from 'fs';
import schedule from 'node-schedule';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { cwd } from 'process';
import { savePhoto } from '../googleApi/googlePhotosAPI.js';
import type { BotContext, Forecast } from '../types/types.js';
import logger, { loggers } from './logger.js';
import { getFestivalData, getCommands } from './dataLoader.js';

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

export const subscribeAlerts = (bot: Bot<BotContext>) => {
  // Alert time delay in minutes
  const alertTimeDelay = 30;
  const concertData = getFestivalData();

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
        const keyboard = new InlineKeyboard().url('view more info', c.url);

        bot.api.sendMessage(process.env.CHAT_ID!, text, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: keyboard,
        });
      });
    });
  });
};

export const saveFile = async (fileId: string, fileExtension: string, ctx: Context) => {
  const filePath = `${cwd()}/downloads/photos/${fileId}.${fileExtension}`;

  try {
    const file = await ctx.api.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${process.env.BOT_DEVELOPMENT_TOKEN || process.env.BOT_PRODUCTION_TOKEN}/${file.file_path}`;

    const stream = await fetchStream(url);
    const nodeStream = Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]);

    nodeStream.pipe(createWriteStream(filePath)).on('finish', () => {
      if (`${process.env.UPLOAD_TO_GPHOTOS}` === 'true') {
        savePhoto(process.env.ALBUM_ID!, filePath);
      }
    });
  } catch (error) {
    loggers.errorWithContext(error as Error, 'saveFile');
  }
};

export const getLineup = (weekDay: string): string => {
  const concertData = getFestivalData();
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

export const getDays = (): string[] => Object.keys(getFestivalData());

export const getDailyMessageText = (weather: Forecast, day: string) =>
  `Hello friends! 👋\n\n` +
  `Hope you had a great night.\n\n` +
  `Today is ${new Date(day).toLocaleDateString('en-EN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}\n\n` +
  `The <a href="${weather.MobileLink}">temperature in Paredes de Coura</a> will range from a low of ↘️ <b>${weather.Temperature.Minimum.Value}ºC</b> to a high of <b>${weather.Temperature.Maximum.Value}ºC</b> ↗️\n\n` +
  `Expect a ${weather.Day.IconPhrase.toLowerCase()}` +
  `<b>${weather.Day.HasPrecipitation ? ' with' : ' without'}</b> rain during the day,\n` +
  `and a ${weather.Night.IconPhrase.toLowerCase()}` +
  `<b>${weather.Night.HasPrecipitation ? ' with' : ' without'}</b> rain kind of night.\n\n` +
  `Wishing you a beautiful day! ❤️`;

export const getWeatherData = async (): Promise<Forecast> => {
  const params = new URLSearchParams({
    apikey: process.env.ACCUWEATHER_API_KEY || '',
    language: 'en-EN',
    details: 'false',
    metric: 'true',
  });

  const url = `http://dataservice.accuweather.com/forecasts/v1/daily/1day/276252?${params}`;
  const response = await fetchJSON<{ DailyForecasts: Forecast[] }>(url);

  return response.DailyForecasts[0];
};

export const generateDailyMessage = async (
  bot: Bot<BotContext>,
  chatId: number,
  isAdmin = false,
) => {
  const weatherData = await getWeatherData();
  const day = new Date().toJSON().slice(0, 10);

  const festivalDays = getDays();

  if (!festivalDays.includes(day) && !isAdmin) {
    return;
  }

  await bot.api.sendMessage(chatId, getDailyMessageText(weatherData, day), {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });

  const lineUp = getLineup(day);

  if (lineUp !== '') {
    try {
      const message = await bot.api.sendMessage(chatId, lineUp, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });

      try {
        await bot.api.unpinAllChatMessages(chatId);
      } catch (unpinError) {
        logger.error('Failed to unpin messages:', unpinError);
      }

      try {
        await bot.api.pinChatMessage(chatId, message.message_id, {
          disable_notification: false,
        });
      } catch (pinError) {
        logger.error('Failed to pin message:', pinError);
      }
    } catch (sendError) {
      logger.error('Failed to send message:', sendError);
    }
  }
};

export const getInfoMessage = (ctx: BotContext) => {
  ctx
    .reply(
      `<b>Useful links:</b>\n\n📷 Google Photos Album : <a href="${process.env.ALBUM_URL}">🏳️‍🌈 Paredes de Coura 2025</a>\n\nℹ️ Pré-Festival Spreadsheet: <a href="https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SPREADSHEET_ID}/edit?usp=sharing">Pré-Festival Paredes de Coura 2025</a>`,
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      },
    )
    .then(() => logger.info('User requested info', { userId: ctx.from?.id }));
};

export const setUserCommands = async (telegramBot: Bot<BotContext>): Promise<void> => {
  const commands = getCommands();
  const publicCommands = commands.filter((c) => !c.adminOnly);
  const adminCommands = commands.map((command) => ({
    command: command.command,
    description: command.description,
  }));

  const adminIds = JSON.parse(process.env.ADMIN_IDS || '[]') as number[];

  await telegramBot.api.setMyCommands(publicCommands, {
    scope: { type: 'all_private_chats' },
  });

  for (const adminId of adminIds) {
    await telegramBot.api.setMyCommands(adminCommands, {
      scope: { type: 'chat', chat_id: adminId },
    });
  }
};
