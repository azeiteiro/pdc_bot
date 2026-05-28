import { fetchJSON } from './http.js';
import { Bot } from 'grammy';
import type { BotContext, Forecast } from '../types/types.js';
import logger from './logger.js';
import { getFestivalData, getCommands } from './dataLoader.js';
import { i18n, DEFAULT_LOCALE } from '../config/i18n.js';

export const getLineup = (weekDay: string, locale: 'en' | 'pt'): string => {
  const concertData = getFestivalData();
  const formattedDay = new Date(weekDay).toLocaleString('pt-PT', {
    weekday: 'long',
    day: '2-digit',
  });
  const response = i18n.translate(locale, 'lineup-header', { day: formattedDay });

  if (!(weekDay in concertData)) {
    return '';
  }

  return `${response}\n\n${concertData[weekDay]
    .map(
      (concert) =>
        `<i>${concert.hour}</i>: <b><a href="${concert.url}">${concert.name}</a></b> - ${concert.stage}\n`,
    )
    .join('')}`;
};

export const getDays = (): string[] => Object.keys(getFestivalData());

export const getDailyMessageText = (
  weather: Forecast,
  day: string,
  locale: 'en' | 'pt',
): string => {
  const formattedDate = new Date(day).toLocaleDateString('pt-PT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return i18n.translate(locale, 'daily-greeting', {
    date: formattedDate,
    weatherLink: weather.MobileLink,
    minTemp: weather.Temperature.Minimum.Value,
    maxTemp: weather.Temperature.Maximum.Value,
    dayPhrase: weather.Day.IconPhrase.toLowerCase(),
    dayHasPrecipitation: weather.Day.HasPrecipitation ? 'yes' : 'no',
    nightPhrase: weather.Night.IconPhrase.toLowerCase(),
    nightHasPrecipitation: weather.Night.HasPrecipitation ? 'yes' : 'no',
  });
};

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

  const text = getDailyMessageText(weatherData, day, DEFAULT_LOCALE);

  await bot.api.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });

  const lineUp = getLineup(day, DEFAULT_LOCALE);

  if (lineUp !== '') {
    try {
      const message = await bot.api.sendMessage(chatId, lineUp, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });

      try {
        await bot.api.unpinAllChatMessages(chatId);
      } catch (unpinError) {
        logger.error({ err: unpinError }, 'Failed to unpin messages:');
      }

      try {
        await bot.api.pinChatMessage(chatId, message.message_id, {
          disable_notification: false,
        });
      } catch (pinError) {
        logger.error({ err: pinError }, 'Failed to pin message:');
      }
    } catch (sendError) {
      logger.error({ err: sendError }, 'Failed to send message:');
    }
  }
};

export const getInfoMessage = (ctx: BotContext) => {
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SPREADSHEET_ID}/edit?usp=sharing`;

  ctx
    .reply(
      ctx.t('info-useful-links', {
        albumUrl: process.env.ALBUM_URL ?? '',
        spreadsheetUrl,
      }),
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      },
    )
    .then(() => logger.info({ userId: ctx.from?.id }, 'User requested info'));
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
