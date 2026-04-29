import { I18n } from '@grammyjs/i18n';
import type { BotContext } from '../types/types.js';

// Configure i18n instance (exported for direct use in conversations)
export const i18n = new I18n<BotContext>({
  defaultLocale: 'en',
  directory: 'src/locales',
  useSession: true,
  localeNegotiator: (ctx) => {
    // Priority 1: User's manual preference (from session)
    if (ctx.session?.preferredLanguage) {
      return ctx.session.preferredLanguage;
    }

    // Priority 2: Auto-detect from Telegram (existing logic)
    const userLang = ctx.from?.language_code;

    if (userLang?.startsWith('pt')) return 'pt';

    // Priority 3: Default to English
    return 'en';
  },
});

// Helper function to get user's locale
export const getUserLocale = (ctx: BotContext): string => {
  const userLang = ctx.from?.language_code;

  return userLang?.startsWith('pt') ? 'pt' : 'en';
};
