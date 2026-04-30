import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../../utils/utils.js', () => ({
  getDays: jest.fn().mockReturnValue(['2026-08-14']),
  getLineup: jest.fn().mockReturnValue('Lineup data'),
  getInfoMessage: jest.fn(),
  saveFile: jest.fn(),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
  loggers: {
    userChat: jest.fn(),
  },
}));

jest.unstable_mockModule('../../scenes/addExpenseScene.js', () => ({
  addExpenseConversation: jest.fn(),
}));

// Import after mocking
const { getDays, getLineup, getInfoMessage, saveFile } = await import('../../utils/utils.js');
const { loggers } = await import('../../utils/logger.js');
const { default: botCommands } = await import('../../botsCommands/generalCommands.js');

import { Bot } from 'grammy';
import { BotContext } from '../../types/types.js';

describe('generalCommands', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockBot: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handlers: Record<string, (...args: any[]) => any> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};
    process.env.ADMIN_IDS = '[123]';
    process.env.GOOGLE_SPREADSHEET_ID = 'test-id';

    mockBot = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: jest.fn((cmd: string, handler: (...args: any[]) => any) => {
        handlers[`command:${cmd}`] = handler;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callbackQuery: jest.fn((action: string | RegExp, handler: (...args: any[]) => any) => {
        handlers[`callbackQuery:${action.toString()}`] = handler;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      on: jest.fn((event: string, handler: (...args: any[]) => any) => {
        handlers[`on:${event}`] = handler;
      }),
      api: {
        getMyCommands: jest
          .fn()
          .mockResolvedValue([{ command: 'help', description: 'Show help' }] as never),
        getMe: jest.fn().mockResolvedValue({ username: 'test-bot' } as never),
      },
    } as unknown as Bot<BotContext>;

    botCommands(mockBot);
  });

  const createCtx = (text: string = '') => {
    const message = {
      text,
      video_note: { file_id: 'vn123' },
      photo: [{ file_id: 'p1' }, { file_id: 'p2' }],
      video: { file_id: 'v123', file_name: 'test.mp4' },
    };

    return {
      from: { id: 123 },
      chat: { id: 456, type: 'private' },
      message,
      update: { message },
      reply: jest.fn(),
      answerCallbackQuery: jest.fn().mockResolvedValue(true as never),
      conversation: { enter: jest.fn() },
      match: [text], // For callback query regex match
    };
  };

  describe('lineup command and callback', () => {
    it('should show day selection keyboard', () => {
      const ctx = createCtx();

      (getDays as jest.Mock).mockReturnValue([
        '2026-08-14',
        '2026-08-15',
        '2026-08-16',
        '2026-08-17',
      ]);

      handlers['command:lineup'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        'Please select the day',
        expect.objectContaining({
          reply_markup: expect.anything(),
        }),
      );
    });

    it('should handle lineup callback', async () => {
      const ctx = createCtx('lineup-2026-08-14');

      (getLineup as jest.Mock).mockReturnValue('Lineup for day');

      // Find the regex key that matches
      const callbackKey = Object.keys(handlers).find((k) => k.startsWith('callbackQuery:'));

      await handlers[callbackKey!](ctx);

      expect(getLineup).toHaveBeenCalledWith('2026-08-14');
      expect(ctx.reply).toHaveBeenCalledWith('Lineup for day', expect.any(Object));
      expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    });

    it('should handle lineup callback error', async () => {
      const ctx = createCtx('lineup-2026-08-14');

      (getLineup as jest.Mock).mockImplementation(() => {
        throw new Error('Fail');
      });

      const callbackKey = Object.keys(handlers).find((k) => k.startsWith('callbackQuery:'));

      await handlers[callbackKey!](ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Unknow error'));
    });
  });

  describe('media handlers', () => {
    it('should handle video_note', () => {
      const ctx = createCtx();

      handlers['on:message:video_note'](ctx);
      expect(saveFile).toHaveBeenCalledWith('vn123', 'mp4', ctx);
    });

    it('should handle photo', () => {
      const ctx = createCtx();

      handlers['on:message:photo'](ctx);
      expect(saveFile).toHaveBeenCalledWith('p2', 'jpg', ctx);
    });

    it('should handle video', () => {
      const ctx = createCtx();

      handlers['on:message:video'](ctx);
      expect(saveFile).toHaveBeenCalledWith('v123', 'mp4', ctx);
    });

    it('should handle video without extension', () => {
      const ctx = createCtx();

      ctx.message.video.file_name = 'test';
      handlers['on:message:video'](ctx);
      expect(saveFile).toHaveBeenCalledWith('v123', 'mp4', ctx);
    });
  });

  it('should handle /info command', () => {
    const ctx = createCtx();

    handlers['command:info'](ctx);
    expect(getInfoMessage).toHaveBeenCalledWith(ctx);
  });

  it('should handle /help command', async () => {
    const ctx = createCtx();

    await handlers['command:help'](ctx);
    expect(mockBot.api.getMyCommands).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('/help - Show help');
  });

  it('should handle /about command', () => {
    const ctx = createCtx();

    handlers['command:about'](ctx);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('allows you to see the schedule'),
    );
  });

  describe('expense command', () => {
    it('should reject if spreadsheet id is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (process.env as any).GOOGLE_SPREADSHEET_ID;
      const ctx = createCtx();

      await handlers['command:expense'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Spreadsheet ID is not set'));
    });

    it('should reject in non-private chat', async () => {
      const ctx = createCtx();

      ctx.chat.type = 'group';
      await handlers['command:expense'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Please use the /expense command in a private chat'),
      );
    });

    it('should enter conversation in private chat', async () => {
      const ctx = createCtx();

      await handlers['command:expense'](ctx);
      expect(ctx.conversation.enter).toHaveBeenCalledWith('addExpenseConversation');
    });
  });

  it('should log text messages', async () => {
    const ctx = createCtx('Hello Bot');
    const next = jest.fn();

    await handlers['on:message:text'](ctx, next);
    expect(loggers.userChat).toHaveBeenCalledWith(123, 'Hello Bot');
    expect(next).toHaveBeenCalled();
  });
});
