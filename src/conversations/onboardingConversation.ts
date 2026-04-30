import type { BotConversation, BotContext } from '../types/types.js';
import { InlineKeyboard } from 'grammy';
import * as chrono from 'chrono-node';
import { loggers } from '../utils/logger.js';
import { i18n, getUserLocaleFromCache } from '../config/i18n.js';
import type { TranslationVariables } from '@grammyjs/i18n';

interface OnboardingData {
  nome: string;
  dataChegada: string;
  dataPartida: string;
  levaCarro: string;
  localPartida: string;
  observacoes: string;
}

/**
 * Parse natural language date using chrono-node
 * Used in Part 2 of onboarding conversation (date collection step)
 */

function parseDate(input: string, locale: string): Date | null {
  const chronoLocale = locale === 'pt' ? chrono.pt : chrono.en;
  const parsed = chronoLocale.parseDate(input, new Date(), { forwardDate: true });

  return parsed;
}

/**
 * Format date to DD/MM/YYYY
 * Used in Part 2 of onboarding conversation (date collection step)
 */

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export async function onboardingConversation(conversation: BotConversation, ctx: BotContext) {
  // Get user's locale from cache (workaround for conversation session access limitation)
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
  });

  const nameResponse = await conversation.waitForCallbackQuery(['name_confirm', 'name_edit']);

  await nameResponse.answerCallbackQuery();

  if (nameResponse.callbackQuery.data === 'name_confirm') {
    data.nome = userName;
  } else {
    await ctx.reply(t('onboarding-name-enter'));
    const nameInput = await conversation.waitFor('message:text');

    data.nome = nameInput.message.text;
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
    const arrivalResponse = await conversation.wait();

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
        });

        const confirmResponse = await conversation.waitForCallbackQuery([
          'date_confirm',
          'date_reject',
        ]);

        await confirmResponse.answerCallbackQuery();

        if (confirmResponse.callbackQuery.data === 'date_confirm') {
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
  const departureKeyboard = new InlineKeyboard().text(
    t('onboarding-btn-dont-know'),
    'departure_unknown',
  );

  await ctx.reply(`${t('onboarding-departure-date')}\n${t('onboarding-date-help')}`, {
    reply_markup: departureKeyboard,
  });

  let departureDateSet = false;

  while (!departureDateSet) {
    const departureResponse = await conversation.wait();

    if (departureResponse.callbackQuery?.data === 'departure_unknown') {
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
        });

        const confirmResponse = await conversation.waitForCallbackQuery([
          'date_confirm_dep',
          'date_reject_dep',
        ]);

        await confirmResponse.answerCallbackQuery();

        if (confirmResponse.callbackQuery.data === 'date_confirm_dep') {
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
}
