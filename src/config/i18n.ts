import { I18n } from '@grammyjs/i18n';
import type { BotContext } from '../types/types.js';

export const DEFAULT_LOCALE = 'pt' as const;

// Locale cache for conversation access (workaround for session access issues in conversations)
const userLocaleCache = new Map<number, 'en' | 'pt'>();

export const setUserLocaleCache = (userId: number, locale: 'en' | 'pt') => {
  userLocaleCache.set(userId, locale);
};

export const getUserLocaleFromCache = (userId: number | undefined): 'en' | 'pt' => {
  if (!userId) return DEFAULT_LOCALE;

  return userLocaleCache.get(userId) || DEFAULT_LOCALE;
};

// Configure i18n instance (exported for direct use in conversations)
export const i18n = new I18n<BotContext>({
  defaultLocale: DEFAULT_LOCALE,
  directory: 'src/locales',
  useSession: true,
  localeNegotiator: (ctx) => {
    // Priority 1: User's manual preference (from session)
    if (ctx.session?.preferredLanguage) {
      // Update cache for conversation access
      if (ctx.from?.id) {
        setUserLocaleCache(ctx.from.id, ctx.session.preferredLanguage);
      }

      return ctx.session.preferredLanguage;
    }

    // Priority 2: Auto-detect from Telegram (existing logic)
    const userLang = ctx.from?.language_code;
    const locale = userLang?.startsWith('pt') ? 'pt' : 'en';

    // Update cache with detected locale
    if (ctx.from?.id) {
      setUserLocaleCache(ctx.from.id, locale);
    }

    return locale;
  },
});

// Helper function to get user's locale
export const getUserLocale = (ctx: BotContext): string => {
  // Priority 1: User's manual preference (from session)
  if (ctx.session?.preferredLanguage) {
    return ctx.session.preferredLanguage;
  }

  // Priority 2: Auto-detect from Telegram
  const userLang = ctx.from?.language_code;

  return userLang?.startsWith('pt') ? 'pt' : 'en';
};
