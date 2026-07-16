import type { BotConversation, BotContext } from '../types/types.js';
import { InlineKeyboard } from 'grammy';
import * as chrono from 'chrono-node';
import { loggers } from '../utils/logger.js';
import { i18n, getUserLocaleFromCache } from '../config/i18n.js';
import type { TranslationVariables } from '@grammyjs/i18n';
import Database from 'better-sqlite3';
import { deleteUser, updateUserStatus } from '../storage/userRepository.js';
import {
  addOnboardingData,
  type OnboardingData as GoogleSheetsOnboardingData,
} from '../googleApi/googleSheetsApi.js';
import logger from '../utils/logger.js';

interface OnboardingData {
  nome: string;
  dataChegada: string;
  dataPartida: string;
  levaCarro: string;
  localPartida: string;
  observacoes: string;
}

let db: Database.Database;

/**
 * Initialize the database reference for the conversation
 */
export function setOnboardingDatabase(database: Database.Database) {
  db = database;
}

/**
 * Parse natural language date using chrono-node
 */
export function parseDate(input: string, locale: string): Date | null {
  const chronoLocale = locale === 'pt' ? chrono.pt : chrono.en;
  const parsed = chronoLocale.parseDate(input, new Date(), { forwardDate: true });

  return parsed;
}

/**
 * Format date to DD/MM/YYYY
 */
export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Returns true if the text is a command that should exit the conversation.
 */
function isEscapeCommand(text: string): boolean {
  return text.startsWith('/cancel') || text.startsWith('/onboarding');
}

/**
 * Waits for any update. Returns null and replies if the user sends an escape command.
 */
async function waitOrExit(
  conversation: BotConversation,
  ctx: BotContext,
  t: (key: string, vars?: TranslationVariables) => string,
): Promise<BotContext | null> {
  const update = await conversation.wait();

  if (isEscapeCommand(update.message?.text ?? '')) {
    await ctx.reply(t('onboarding-cancelled'));

    return null;
  }

  return update as unknown as BotContext;
}

/**
 * Waits for one of the given callback query values, ignoring other updates.
 * Returns null and replies if the user sends an escape command instead.
 */
async function waitForCallbackOrExit(
  conversation: BotConversation,
  ctx: BotContext,
  t: (key: string, vars?: TranslationVariables) => string,
  callbacks: string[],
): Promise<BotContext | null> {
  while (true) {
    const update = await conversation.wait();

    if (isEscapeCommand(update.message?.text ?? '')) {
      await ctx.reply(t('onboarding-cancelled'));

      return null;
    }

    if (update.callbackQuery?.data && callbacks.includes(update.callbackQuery.data)) {
      await update.answerCallbackQuery();

      return update as unknown as BotContext;
    }
  }
}

export async function onboardingConversation(
  conversation: BotConversation,
  ctx: BotContext,
): Promise<void> {
  const locale = getUserLocaleFromCache(ctx.from?.id);
  const t = (key: string, vars?: TranslationVariables) => i18n.translate(locale, key, vars);

  const data: OnboardingData = {
    nome: '',
    dataChegada: '',
    dataPartida: '',
    levaCarro: '',
    localPartida: '',
    observacoes: '',
  };

  // Step 1: Name confirmation
  const userName = `${ctx.from?.first_name || ''} ${ctx.from?.last_name || ''}`.trim();
  const nameKeyboard = new InlineKeyboard()
    .text(t('onboarding-btn-confirm'), 'name_confirm')
    .text(t('onboarding-btn-edit'), 'name_edit');

  await ctx.reply(t('onboarding-name-confirm', { name: userName }), {
    reply_markup: nameKeyboard,
    parse_mode: 'Markdown',
  });

  const nameResponse = await waitForCallbackOrExit(conversation, ctx, t, [
    'name_confirm',
    'name_edit',
  ]);

  if (!nameResponse) return;

  if (nameResponse.callbackQuery?.data === 'name_confirm') {
    data.nome = userName;
  } else {
    await ctx.reply(t('onboarding-name-enter'));

    const nameInput = await waitOrExit(conversation, ctx, t);

    if (!nameInput) return;

    data.nome = nameInput.message?.text ?? userName;
  }

  loggers.userChat(ctx.from?.id || 0, 'Onboarding: name collected', { nome: data.nome });

  // Step 2: Arrival date
  const arrivalKeyboard = new InlineKeyboard().text(
    t('onboarding-btn-dont-know'),
    'arrival_unknown',
  );

  await ctx.reply(`${t('onboarding-arrival-date')}\n${t('onboarding-date-help')}`, {
    reply_markup: arrivalKeyboard,
  });

  let arrivalDateSet = false;

  while (!arrivalDateSet) {
    const arrivalResponse = await waitOrExit(conversation, ctx, t);

    if (!arrivalResponse) return;

    if (arrivalResponse.callbackQuery?.data === 'arrival_unknown') {
      await arrivalResponse.answerCallbackQuery();
      data.dataChegada = t('onboarding-dont-know');
      arrivalDateSet = true;
    } else if (arrivalResponse.message?.text) {
      const parsedDate = parseDate(arrivalResponse.message.text, locale);

      if (parsedDate) {
        const formattedDate = formatDate(parsedDate);
        const confirmKeyboard = new InlineKeyboard()
          .text('✓', 'date_confirm')
          .text('✗', 'date_reject');

        await ctx.reply(t('onboarding-date-confirm', { date: formattedDate }), {
          reply_markup: confirmKeyboard,
          parse_mode: 'Markdown',
        });

        const confirmResponse = await waitForCallbackOrExit(conversation, ctx, t, [
          'date_confirm',
          'date_reject',
        ]);

        if (!confirmResponse) return;

        if (confirmResponse.callbackQuery?.data === 'date_confirm') {
          data.dataChegada = formattedDate;
          arrivalDateSet = true;
        } else {
          await ctx.reply(t('onboarding-date-invalid'));
        }
      } else {
        await ctx.reply(t('onboarding-date-invalid'));
      }
    }
  }

  loggers.userChat(ctx.from?.id || 0, 'Onboarding: arrival date collected', {
    dataChegada: data.dataChegada,
  });

  // Step 3: Departure date
  const departureKeyboard = new InlineKeyboard()
    .text(t('onboarding-btn-last-day'), 'departure_last_day')
    .text(t('onboarding-btn-dont-know'), 'departure_unknown');

  await ctx.reply(`${t('onboarding-departure-date')}\n${t('onboarding-date-help')}`, {
    reply_markup: departureKeyboard,
  });

  let departureDateSet = false;

  while (!departureDateSet) {
    const departureResponse = await waitOrExit(conversation, ctx, t);

    if (!departureResponse) return;

    if (departureResponse.callbackQuery?.data === 'departure_last_day') {
      await departureResponse.answerCallbackQuery();
      data.dataPartida = '16/08/2026';
      departureDateSet = true;
    } else if (departureResponse.callbackQuery?.data === 'departure_unknown') {
      await departureResponse.answerCallbackQuery();
      data.dataPartida = t('onboarding-dont-know');
      departureDateSet = true;
    } else if (departureResponse.message?.text) {
      const parsedDate = parseDate(departureResponse.message.text, locale);

      if (parsedDate) {
        const formattedDate = formatDate(parsedDate);
        const confirmKeyboard = new InlineKeyboard()
          .text('✓', 'date_confirm_dep')
          .text('✗', 'date_reject_dep');

        await ctx.reply(t('onboarding-date-confirm', { date: formattedDate }), {
          reply_markup: confirmKeyboard,
          parse_mode: 'Markdown',
        });

        const confirmResponse = await waitForCallbackOrExit(conversation, ctx, t, [
          'date_confirm_dep',
          'date_reject_dep',
        ]);

        if (!confirmResponse) return;

        if (confirmResponse.callbackQuery?.data === 'date_confirm_dep') {
          data.dataPartida = formattedDate;
          departureDateSet = true;
        } else {
          await ctx.reply(t('onboarding-date-invalid'));
        }
      } else {
        await ctx.reply(t('onboarding-date-invalid'));
      }
    }
  }

  loggers.userChat(ctx.from?.id || 0, 'Onboarding: departure date collected', {
    dataPartida: data.dataPartida,
  });

  // Step 4: Car question
  const carKeyboard = new InlineKeyboard()
    .text(t('onboarding-btn-yes-car'), 'car_yes')
    .text(t('onboarding-btn-no-car'), 'car_no');

  await ctx.reply(t('onboarding-car-question'), { reply_markup: carKeyboard });

  const carResponse = await waitForCallbackOrExit(conversation, ctx, t, ['car_yes', 'car_no']);

  if (!carResponse) return;

  const hasCar = carResponse.callbackQuery?.data === 'car_yes';

  data.levaCarro = hasCar ? t('onboarding-yes') : t('onboarding-no');

  loggers.userChat(ctx.from?.id || 0, 'Onboarding: car question answered', {
    levaCarro: data.levaCarro,
  });

  // Step 5: Departure location (always asked)
  const locationKeyboard = new InlineKeyboard()
    .text('Lisboa', 'location_lisboa')
    .text('Porto', 'location_porto')
    .text('Coimbra', 'location_coimbra');

  await ctx.reply(t('onboarding-departure-location'), { reply_markup: locationKeyboard });

  const locationResponse = await waitOrExit(conversation, ctx, t);

  if (!locationResponse) return;

  if (locationResponse.callbackQuery?.data?.startsWith('location_')) {
    await locationResponse.answerCallbackQuery();
    const city = locationResponse.callbackQuery.data.replace('location_', '');

    data.localPartida = city.charAt(0).toUpperCase() + city.slice(1);
  } else if (locationResponse.message?.text) {
    data.localPartida = locationResponse.message.text;
  } else {
    data.localPartida = '';
  }

  loggers.userChat(ctx.from?.id || 0, 'Onboarding: departure location collected', {
    localPartida: data.localPartida,
  });

  // Step 6: Additional information
  const skipKeyboard = new InlineKeyboard().text(t('onboarding-btn-skip'), 'info_skip');

  await ctx.reply(t('onboarding-additional-info'), { reply_markup: skipKeyboard });

  const infoResponse = await waitOrExit(conversation, ctx, t);

  if (!infoResponse) return;

  if (infoResponse.callbackQuery?.data === 'info_skip') {
    await infoResponse.answerCallbackQuery();
    data.observacoes = '';
  } else if (infoResponse.message?.text) {
    data.observacoes = infoResponse.message.text;
  } else {
    data.observacoes = '';
  }

  loggers.userChat(ctx.from?.id || 0, 'Onboarding: additional info collected', {
    observacoes: data.observacoes,
  });

  // Step 7: Summary and confirmation
  const summaryMessage = t('onboarding-summary', {
    name: data.nome,
    arrival: data.dataChegada,
    departure: data.dataPartida,
    car: data.levaCarro,
    departureLocation: data.localPartida || 'empty',
    additionalInfo: data.observacoes || 'empty',
  });

  const confirmKeyboard = new InlineKeyboard()
    .text(t('onboarding-btn-submit'), 'summary_submit')
    .text(t('onboarding-btn-cancel'), 'summary_cancel');

  await ctx.reply(summaryMessage, { reply_markup: confirmKeyboard });

  const summaryResponse = await waitForCallbackOrExit(conversation, ctx, t, [
    'summary_submit',
    'summary_cancel',
  ]);

  if (!summaryResponse) return;

  if (summaryResponse.callbackQuery?.data === 'summary_cancel') {
    loggers.userChat(ctx.from?.id || 0, 'Onboarding: cancelled at summary', {});

    const userId = ctx.from?.id;

    if (userId) {
      deleteUser(db, userId);
      await ctx.reply(t('onboarding-cancelled'));
      logger.info({ userId }, 'Onboarding cancelled by user at summary');
    }

    return;
  }

  loggers.userChat(ctx.from?.id || 0, 'Onboarding: summary confirmed', data);

  // Handle successful completion
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'unknown';

  if (!userId) {
    return;
  }

  const sheetData: GoogleSheetsOnboardingData = {
    nome: data.nome,
    dataChegada: data.dataChegada,
    dataPartida: data.dataPartida,
    levaCarro: data.levaCarro,
    localPartida: data.localPartida,
    observacoes: data.observacoes,
    userId,
  };

  try {
    await addOnboardingData(sheetData);

    updateUserStatus(db, userId, 'WAITING_PAYMENT');

    const mbwayNumber = process.env.MBWAY_NUMBER || '';
    const paymentKeyboard = new InlineKeyboard().url(
      t('onboarding-btn-pay-revolut'),
      'https://revolut.me/azeiteiro',
    );

    await ctx.reply(t('onboarding-payment-instructions', { mbwayNumber }), {
      reply_markup: paymentKeyboard,
    });

    const adminIds = JSON.parse(process.env.ADMIN_IDS || '[]') as number[];

    if (adminIds.length > 0) {
      const notification = t('onboarding-admin-notification', {
        username,
        userId: String(userId),
      });

      await ctx.api.sendMessage(adminIds[0], notification);
      logger.info({ userId, adminId: adminIds[0] }, 'Admin notified of new onboarding submission');
    }

    logger.info({ userId, status: 'WAITING_PAYMENT' }, 'Onboarding completed successfully');
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to save onboarding data');
    await ctx.reply(t('onboarding-error-save-failed'));
  }
}
