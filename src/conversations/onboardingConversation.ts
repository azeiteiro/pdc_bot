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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseDate(input: string, locale: string): Date | null {
  const chronoLocale = locale === 'pt' ? chrono.pt : chrono.en;
  const parsed = chronoLocale.parseDate(input, new Date(), { forwardDate: true });

  return parsed;
}

/**
 * Format date to DD/MM/YYYY
 * Used in Part 2 of onboarding conversation (date collection step)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
}
