import { i18n, DEFAULT_LOCALE, getUserLocaleFromCache } from '../../config/i18n.js';
import type { BotContext } from '../../types/types.js';

describe('i18n Configuration', () => {
  describe('localeNegotiator', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getLocaleNegotiator = () => (i18n as any).config.localeNegotiator;

    it('should prioritize session preferredLanguage over Telegram language_code', () => {
      const mockCtx = {
        session: { preferredLanguage: 'pt' as const },
        from: { language_code: 'en' },
      } as unknown as BotContext;

      const negotiator = getLocaleNegotiator();
      const result = negotiator(mockCtx);

      expect(result).toBe('pt');
    });

    it('should use Telegram language_code when no session preference', () => {
      const mockCtx = {
        session: {},
        from: { language_code: 'pt-BR' },
      } as unknown as BotContext;

      const negotiator = getLocaleNegotiator();
      const result = negotiator(mockCtx);

      expect(result).toBe('pt');
    });

    it('should default to pt when no preference and unsupported language_code', () => {
      const mockCtx = {
        session: {},
        from: { language_code: 'es' },
      } as unknown as BotContext;

      const negotiator = getLocaleNegotiator();
      const result = negotiator(mockCtx);

      expect(result).toBe('pt');
    });

    it('should default to pt when no preference and no language_code', () => {
      const mockCtx = {
        session: {},
        from: {},
      } as unknown as BotContext;

      const negotiator = getLocaleNegotiator();
      const result = negotiator(mockCtx);

      expect(result).toBe('pt');
    });

    it('should default to pt when no preference and English language_code', () => {
      const mockCtx = {
        session: {},
        from: { language_code: 'en' },
      } as unknown as BotContext;

      const negotiator = getLocaleNegotiator();
      const result = negotiator(mockCtx);

      expect(result).toBe('pt');
    });

    it('should prefer session preferredLanguage en over pt language_code', () => {
      const mockCtx = {
        session: { preferredLanguage: 'en' as const },
        from: { language_code: 'pt' },
      } as unknown as BotContext;

      const negotiator = getLocaleNegotiator();
      const result = negotiator(mockCtx);

      expect(result).toBe('en');
    });
  });

  describe('DEFAULT_LOCALE', () => {
    it('should export DEFAULT_LOCALE as pt', () => {
      expect(DEFAULT_LOCALE).toBe('pt');
    });
  });

  describe('getUserLocaleFromCache', () => {
    it('should return DEFAULT_LOCALE when userId is undefined', () => {
      expect(getUserLocaleFromCache(undefined)).toBe('pt');
    });

    it('should return DEFAULT_LOCALE when user not in cache', () => {
      expect(getUserLocaleFromCache(99999)).toBe('pt');
    });
  });

  describe('href interpolation', () => {
    it('should not wrap interpolated URLs in bidi isolation marks that break href attributes', () => {
      const rendered = i18n.t('pt', 'info-useful-links', {
        albumUrl: 'https://example.com/album',
        spreadsheetUrl: 'https://example.com/sheet',
      });

      expect(rendered).toContain('href="https://example.com/album"');
      expect(rendered).toContain('href="https://example.com/sheet"');
    });
  });
});
