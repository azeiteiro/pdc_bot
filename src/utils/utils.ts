import { fetchJSON } from './http.js';
import { Bot } from 'grammy';
import type { BotContext, Forecast } from '../types/types.js';
import logger from './logger.js';
import { getFestivalData, getCommands } from './dataLoader.js';
import { i18n, DEFAULT_LOCALE } from '../config/i18n.js';

export const getLineup = (weekDay: string, locale: 'en' | 'pt'): string => {
  const concertData = getFestivalData();

  if (!(weekDay in concertData)) {
    return '';
  }

  const dateLocale = locale === 'pt' ? 'pt-PT' : 'en-GB';
  const formattedDay = new Date(weekDay).toLocaleString(dateLocale, {
    weekday: 'long',
    day: '2-digit',
  });
  const response = i18n.translate(locale, 'lineup-header', { day: formattedDay });

  return `${response}\n\n${concertData[weekDay]
    .map(
      (concert) =>
        `<i>${concert.hour}</i>: <b><a href="${concert.url}">${concert.name}</a></b> - ${concert.stage}\n`,
    )
    .join('')}`;
};

export const getDays = (): string[] => Object.keys(getFestivalData());

type IpmaDay = {
  forecastDate: string;
  tMin: string | number;
  tMax: string | number;
  precipitaProb: string | number;
  idWeatherType: number;
  predWindDir: string;
  classWindSpeed: number;
};

const WEATHER_EMOJI: Record<number, string> = {
  1: '☀️',
  2: '🌤️',
  3: '⛅',
  4: '🌥️',
  5: '☁️',
  6: '🌦️',
  7: '🌧️',
  8: '🌧️',
  9: '⛈️',
  10: '🌧️',
  11: '🌧️',
  12: '🌧️',
  13: '❄️',
  14: '❄️',
  15: '🌨️',
  16: '🌨️',
  17: '🌫️',
  18: '🌫️',
  19: '💨',
  20: '🌩️',
  21: '⛈️',
  22: '🌨️',
  23: '🌤️',
  24: '🌤️',
  25: '🌤️',
  26: '⛅',
  27: '🌦️',
  28: '🌦️',
  29: '⛈️',
  30: '🌧️',
};

const WEATHER_DESC: Record<number, { en: string; pt: string }> = {
  1: { en: 'Sunny', pt: 'Sol' },
  2: { en: 'Partly cloudy', pt: 'Pouco nublado' },
  3: { en: 'Sunny intervals', pt: 'Céu nublado por vezes' },
  4: { en: 'Cloudy', pt: 'Céu nublado' },
  5: { en: 'Overcast', pt: 'Céu muito nublado' },
  6: { en: 'Light showers', pt: 'Aguaceiros fracos' },
  7: { en: 'Showers', pt: 'Aguaceiros' },
  8: { en: 'Heavy showers', pt: 'Aguaceiros fortes' },
  9: { en: 'Thunderstorms', pt: 'Aguaceiros e trovoadas' },
  10: { en: 'Light rain', pt: 'Chuva fraca' },
  11: { en: 'Rain', pt: 'Chuva' },
  12: { en: 'Heavy rain', pt: 'Chuva forte' },
  13: { en: 'Light snow', pt: 'Neve fraca' },
  14: { en: 'Snow', pt: 'Neve' },
  15: { en: 'Heavy snow', pt: 'Neve forte' },
  16: { en: 'Sleet', pt: 'Chuva e neve' },
  17: { en: 'Fog', pt: 'Nevoeiro' },
  18: { en: 'Light fog', pt: 'Nevoeiro ligeiro' },
  19: { en: 'Windy', pt: 'Vento forte' },
  20: { en: 'Thunderstorm', pt: 'Trovoada' },
  21: { en: 'Hail showers', pt: 'Aguaceiros com granizo' },
  22: { en: 'Hail', pt: 'Granizo' },
  23: { en: 'Partly cloudy', pt: 'Pouco nublado' },
  24: { en: 'Partly cloudy', pt: 'Pouco nublado' },
  25: { en: 'Partly cloudy', pt: 'Pouco nublado' },
  26: { en: 'Partly cloudy', pt: 'Céu nublado por vezes' },
  27: { en: 'Light showers', pt: 'Aguaceiros fracos' },
  28: { en: 'Light showers', pt: 'Aguaceiros fracos' },
  29: { en: 'Thunderstorms', pt: 'Aguaceiros e trovoadas' },
  30: { en: 'Light rain', pt: 'Chuva fraca' },
};

export const getDailyMessageText = (
  weather: Forecast,
  day: string,
  locale: 'en' | 'pt',
): string => {
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'en-GB';
  const formattedDate = new Date(day).toLocaleDateString(dateLocale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const desc = WEATHER_DESC[weather.idWeatherType];
  const weatherEmoji = WEATHER_EMOJI[weather.idWeatherType] ?? '🌡️';
  const weatherDescription = desc ? (locale === 'pt' ? desc.pt : desc.en) : '';
  const precipitationWarning = weather.precipitaProb >= 30 ? '⚠️ ' : '';

  return i18n.translate(locale, 'daily-greeting', {
    date: formattedDate,
    weatherEmoji,
    weatherDescription,
    minTemp: weather.tMin,
    maxTemp: weather.tMax,
    precipitaProb: weather.precipitaProb,
    precipitationWarning,
  });
};

export const getWeatherData = async (): Promise<Forecast> => {
  const locationId = process.env.IPMA_LOCATION_ID;
  const url = `https://api.ipma.pt/open-data/forecast/meteorology/cities/daily/${locationId}.json`;
  const response = await fetchJSON<{ data: IpmaDay[] }>(url);
  const todayStr = new Date().toJSON().slice(0, 10);
  const today = response.data.find((d) => d.forecastDate === todayStr) ?? response.data[0];

  return {
    forecastDate: today.forecastDate,
    tMin: Math.round(Number(today.tMin)),
    tMax: Math.round(Number(today.tMax)),
    precipitaProb: Math.round(Number(today.precipitaProb)),
    idWeatherType: today.idWeatherType,
  };
};

export const generateDailyMessage = async (
  bot: Bot<BotContext>,
  chatId: number,
  isAdmin = false,
) => {
  const day = new Date().toJSON().slice(0, 10);
  const festivalDays = getDays();

  if (!festivalDays.includes(day) && !isAdmin) {
    return;
  }

  const weatherData = await getWeatherData();
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
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${process.env.ONBOARDING_SPREADSHEET_ID}/edit?usp=sharing`;

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

  const toEn = (c: (typeof commands)[0]) => ({ command: c.command, description: c.description });
  const toPt = (c: (typeof commands)[0]) => ({
    command: c.command,
    description: c.description_pt ?? c.description,
  });

  const publicEn = commands.filter((c) => !c.adminOnly).map(toEn);
  const publicPt = commands.filter((c) => !c.adminOnly).map(toPt);
  const adminEn = commands.map(toEn);
  const adminPt = commands.map(toPt);

  const adminIds = JSON.parse(process.env.ADMIN_IDS || '[]') as number[];

  await telegramBot.api.setMyCommands(publicEn, { scope: { type: 'all_private_chats' } });
  await telegramBot.api.setMyCommands(publicPt, {
    scope: { type: 'all_private_chats' },
    language_code: 'pt',
  });

  for (const adminId of adminIds) {
    await telegramBot.api.setMyCommands(adminEn, { scope: { type: 'chat', chat_id: adminId } });
    await telegramBot.api.setMyCommands(adminPt, {
      scope: { type: 'chat', chat_id: adminId },
      language_code: 'pt',
    });
  }
};
