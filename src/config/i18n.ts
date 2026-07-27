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
  // Fluent wraps interpolated values in invisible bidi-isolation marks (U+2068/U+2069)
  // by default. That corrupts any variable used inside an HTML attribute (e.g.
  // href="{$url}"), since Telegram then fails to recognize it as a valid URL and
  // silently drops the <a> tag.
  fluentBundleOptions: { useIsolating: false },
  localeNegotiator: (ctx) => {
    // Priority 1: User's manual preference (from session)
    if (ctx.session?.preferredLanguage) {
      // Update cache for conversation access
      if (ctx.from?.id) {
        setUserLocaleCache(ctx.from.id, ctx.session.preferredLanguage);
      }

      return ctx.session.preferredLanguage;
    }

    // Priority 2: Default to pt (users can opt into en via /language)
    if (ctx.from?.id) {
      setUserLocaleCache(ctx.from.id, DEFAULT_LOCALE);
    }

    return DEFAULT_LOCALE;
  },
});

// Helper function to get user's locale
export const getUserLocale = (ctx: BotContext): 'en' | 'pt' => {
  // Priority 1: User's manual preference (from session)
  if (ctx.session?.preferredLanguage) {
    return ctx.session.preferredLanguage;
  }

  // Priority 2: Default to pt (users can opt into en via /language)
  return DEFAULT_LOCALE;
};
