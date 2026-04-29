import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocking
const { registerLanguageCommand } = await import('../../botsCommands/languageCommand.js');

import { Bot } from 'grammy';
import type { BotContext } from '../../types/types.js';

describe('Language Command', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockBot: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handlers: Record<string, (...args: any[]) => any> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};

    mockBot = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: jest.fn((cmd: string, handler: (...args: any[]) => any) => {
        handlers[`command:${cmd}`] = handler;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callbackQuery: jest.fn((action: string | RegExp, handler: (...args: any[]) => any) => {
        handlers[`callbackQuery:${action.toString()}`] = handler;
      }),
    } as unknown as Bot<BotContext>;

    registerLanguageCommand(mockBot);
  });

  const createCtx = () => {
    return {
      from: { id: 123 },
      chat: { id: 456, type: 'private' as const },
      reply: jest.fn().mockResolvedValue(true),
      t: jest.fn((key: string) => {
        const translations: Record<string, string> = {
          'language-selection-prompt': 'Choose your language:',
          'language-changed': 'Language changed to {$language}',
        };

        return translations[key] || key;
      }),
      session: {},
      answerCallbackQuery: jest.fn().mockResolvedValue(true),
    };
  };

  describe('registerLanguageCommand', () => {
    it('should register language command handler', () => {
      expect(handlers['command:language']).toBeDefined();
    });

    it('should show inline keyboard with language options', async () => {
      const ctx = createCtx();

      await handlers['command:language'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        'Choose your language:',
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        }),
      );

      // Verify the keyboard structure
      const callArgs = ctx.reply.mock.calls[0];
      const keyboard = callArgs[1].reply_markup.inline_keyboard;

      // Should have at least one row with language buttons
      expect(keyboard.length).toBeGreaterThan(0);
      expect(keyboard[0]).toEqual([
        expect.objectContaining({ text: '🇬🇧 English', callback_data: 'lang:en' }),
        expect.objectContaining({ text: '🇵🇹 Português', callback_data: 'lang:pt' }),
      ]);
    });
  });

  describe('language callback handler', () => {
    it('should register callback query handler for language selection', () => {
      const callbackKeys = Object.keys(handlers).filter((k) => k.startsWith('callbackQuery:'));

      expect(callbackKeys.length).toBeGreaterThan(0);
    });

    it('should handle English language selection', async () => {
      const ctx = createCtx();

      ctx.match = ['lang:en', 'en'];

      const callbackKey = Object.keys(handlers).find(
        (k) => k.startsWith('callbackQuery:') && handlers[k],
      );

      if (callbackKey) {
        await handlers[callbackKey](ctx);

        // Session should be updated
        expect(ctx.session.preferredLanguage).toBe('en');

        // User should be notified
        expect(ctx.reply).toHaveBeenCalled();

        // Callback query should be answered
        expect(ctx.answerCallbackQuery).toHaveBeenCalled();
      }
    });

    it('should handle Portuguese language selection', async () => {
      const ctx = createCtx();

      ctx.match = ['lang:pt', 'pt'];

      const callbackKey = Object.keys(handlers).find(
        (k) => k.startsWith('callbackQuery:') && handlers[k],
      );

      if (callbackKey) {
        await handlers[callbackKey](ctx);

        // Session should be updated
        expect(ctx.session.preferredLanguage).toBe('pt');

        // User should be notified
        expect(ctx.reply).toHaveBeenCalled();

        // Callback query should be answered
        expect(ctx.answerCallbackQuery).toHaveBeenCalled();
      }
    });
  });
});
