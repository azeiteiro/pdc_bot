import { InlineKeyboard } from 'grammy';
import type { Bot } from 'grammy';
import type { BotContext } from '../types/types.js';
import logger from '../utils/logger.js';
import { setUserLocaleCache } from '../config/i18n.js';

export const registerLanguageCommand = (bot: Bot<BotContext>) => {
  // Command handler for /language
  bot.command('language', async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text('🇬🇧 English', 'lang:en')
      .text('🇵🇹 Português', 'lang:pt');

    await ctx.reply(ctx.t('language-selection-prompt'), {
      reply_markup: keyboard,
    });

    logger.info({ userId: ctx.from?.id }, 'User requested language selection');
  });

  // Callback handler for language selection buttons
  bot.callbackQuery(/^lang:(en|pt)$/, async (ctx) => {
    try {
      if (!ctx.match) return;

      const selectedLanguage = ctx.match[1] as 'en' | 'pt';

      // Update session with selected language
      ctx.session.preferredLanguage = selectedLanguage;

      // Update locale cache for conversation access
      if (ctx.from?.id) {
        setUserLocaleCache(ctx.from.id, selectedLanguage);
      }

      // Use i18n.translate directly with the selected language to ensure correct translation
      const { i18n } = await import('../config/i18n.js');
      const confirmationMessage = i18n.translate(selectedLanguage, 'language-changed');

      await ctx.reply(confirmationMessage, {
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();

      logger.info({ userId: ctx.from?.id, language: selectedLanguage }, 'User selected language');
    } catch (e) {
      logger.error(e);
      await ctx.reply(ctx.t('language-error')).catch(() => {});
      await ctx.answerCallbackQuery(ctx.t('language-error-answer')).catch(() => {});
    }
  });
};
