import { InlineKeyboard } from 'grammy';
import type { Bot } from 'grammy';
import type { BotContext } from '../types/types.js';
import logger from '../utils/logger.js';

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

      // Notify user with localized message
      await ctx.reply(ctx.t('language-changed'), {
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();

      logger.info({ userId: ctx.from?.id, language: selectedLanguage }, 'User selected language');
    } catch (e) {
      logger.error(e);
      await ctx
        .reply('An error occurred while changing language. Please try again.')
        .catch(() => {});
      await ctx.answerCallbackQuery('Error changing language').catch(() => {});
    }
  });
};
