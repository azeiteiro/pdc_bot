import { I18n } from '@grammyjs/i18n';
import type { BotContext } from '../types/types.js';

// Configure i18n instance (exported for direct use in conversations)
export const i18n = new I18n<BotContext>({
  defaultLocale: 'en',
  directory: 'src/locales',
  useSession: true,
  localeNegotiator: (ctx) => {
    const userLang = ctx.from?.language_code;

    // Map all Portuguese variants to pt (European Portuguese)
    if (userLang?.startsWith('pt')) return 'pt';

    // Default to English for everything else
    return 'en';
  },
});

// Helper function to get user's locale
export const getUserLocale = (ctx: BotContext): string => {
  const userLang = ctx.from?.language_code;

  return userLang?.startsWith('pt') ? 'pt' : 'en';
};
