import { i18n } from '../../config/i18n.js';
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

    it('should default to en when no preference and unsupported language_code', () => {
      const mockCtx = {
        session: {},
        from: { language_code: 'es' },
      } as unknown as BotContext;

      const negotiator = getLocaleNegotiator();
      const result = negotiator(mockCtx);

      expect(result).toBe('en');
    });

    it('should default to en when no preference and no language_code', () => {
      const mockCtx = {
        session: {},
        from: {},
      } as unknown as BotContext;

      const negotiator = getLocaleNegotiator();
      const result = negotiator(mockCtx);

      expect(result).toBe('en');
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
});
