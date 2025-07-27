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

const formatName = (name: string) => {
  if (!name || name === 'Unknown') {
    return 'Unknown';
  }

  // Convert to string and trim whitespace
  const nameStr = String(name).trim();

  if (!nameStr) {
    return 'Unknown';
  }

  // Split by spaces and filter out empty strings
  const nameParts = nameStr.split(' ').filter((part) => part.length > 0);

  if (nameParts.length === 0) {
    return 'Unknown';
  } else if (nameParts.length === 1) {
    // Single name - return as is
    return nameParts[0];
  } else {
    // Multiple names - first name + first letter of last name with dot
    const firstName = nameParts[0];
    const lastNameInitial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();

    return `${firstName} ${lastNameInitial}.`;
  }
};

// Helper function to parse DD/MM/YYYY format
const parseDDMMYYYY = (dateStr: string): Date => {
  if (!dateStr || dateStr === 'Unknown date') {
    return new Date(0); // Return epoch for unknown dates
  }

  try {
    const [day, month, year] = dateStr.split('/');
    // Month is 0-indexed in JavaScript Date constructor

    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } catch {
    return new Date(0);
  }
};

// Helper function to parse Euro amounts (€123 -> 123)
const parseEuroAmount = (amountStr: string): number => {
  if (!amountStr) return 0;

  // Remove € symbol and any whitespace, then convert to number
  const numericValue = amountStr.replace('€', '').trim();

  return parseFloat(numericValue) || 0;
};

// Helper function to format date headers
const formatDateHeader = (dateStr: string): string => {
  if (dateStr === 'Unknown date') {
    return 'Unknown date';
  }

  try {
    const date = parseDDMMYYYY(dateStr);
    const today = new Date();
    const yesterday = new Date(today);

    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time for comparison
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) {
      return 'Today';
    }

    if (date.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }

    // Format as "Monday, Jan 15"
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const formatExpenses = (expenses: string[][]): string => {
  if (!expenses || expenses.length === 0) {
    return 'No expenses found.';
  }

  // Filter out empty rows
  const validExpenses = expenses.filter((row) => row[0] !== undefined && row[0] !== '');

  if (validExpenses.length === 0) {
    return 'No expenses found.';
  }

  // Separate the total row from regular expenses
  const totalRow = validExpenses[validExpenses.length - 1];
  const regularExpenses = validExpenses.slice(0, -1);

  if (regularExpenses.length === 0) {
    return 'No expenses found.';
  }

  // Group regular expenses by date
  const groupedByDate = regularExpenses.reduce(
    (groups, row) => {
      const date = row[3] || 'Unknown date';

      if (!groups[date]) {
        groups[date] = [];
      }

      groups[date].push(row);

      return groups;
    },
    {} as { [key: string]: string[][] },
  );

  const parseDate = (dateStr: string): number => {
    if (dateStr === 'Unknown date') return -Infinity;

    const [day, month, year] = dateStr.split('/');
    const iso = `${year}-${month}-${day}`;

    return new Date(iso).getTime();
  };

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
    if (a === 'Unknown date') return 1;
    if (b === 'Unknown date') return -1;

    return parseDate(a) - parseDate(b); // Ascending
  });

  // Format the grouped expenses
  const formattedExpenses = sortedDates
    .map((date) => {
      const expensesForDate = groupedByDate[date];
      const dateHeader = formatDateHeader(date);

      // Calculate daily total
      const dailyTotal = expensesForDate.reduce(
        (sum, row) => sum + parseEuroAmount(row[1] || '€0'),
        0,
      );

      const expenseList = expensesForDate
        .map(
          (row) => `  • <b>${row[1]}</b> - <code>${row[0]}</code> (<i>${formatName(row[2])}</i>)`,
        )
        .join('\n');

      return `📅 <b>${dateHeader}</b> - Total: <code>€${dailyTotal.toFixed(2)}</code>\n${expenseList}`;
    })
    .join('\n\n');

  // Add the grand total at the end
  const grandTotal = `\n\n💰 <b>Grand Total: ${totalRow[1]}</b>`;

  return formattedExpenses + grandTotal;
};
