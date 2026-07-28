import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../../googleApi/googlePhotosAPI.js', () => ({
  createAlbum: jest.fn(),
  getAlbums: jest.fn(),
  getAlbumInfo: jest.fn(),
}));

jest.unstable_mockModule('../../googleApi/googleSheetsApi.js', () => ({
  getSheetData: jest.fn(),
  getOffboardingBalances: jest.fn(),
}));

jest.unstable_mockModule('../../storage/userRepository.js', () => ({
  getAllUsers: jest.fn(),
  getAllCompletedUsers: jest.fn(),
  getUserById: jest.fn(),
}));

jest.unstable_mockModule('../../config/i18n.js', () => ({
  i18n: {
    translate: jest.fn().mockReturnValue('mocked translation'),
    middleware: jest.fn(),
  },
}));

jest.unstable_mockModule('../../utils/formatters.js', () => ({
  formatExpenses: jest.fn(),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  loggers: {
    botResponse: jest.fn(),
    errorWithContext: jest.fn(),
  },
}));

jest.unstable_mockModule('../../utils/utils.js', () => ({
  generateDailyMessage: jest.fn(),
}));

jest.unstable_mockModule('../../config/environment.js', () => ({
  config: { groupChatId: 'group-chat-123' },
}));

import { Bot } from 'grammy';
import { BotContext } from '../../types/types.js';

const { createAlbum, getAlbums, getAlbumInfo } = await import('../../googleApi/googlePhotosAPI.js');
const { getSheetData, getOffboardingBalances } = await import('../../googleApi/googleSheetsApi.js');
const { getAllUsers, getAllCompletedUsers, getUserById } =
  await import('../../storage/userRepository.js');
const { formatExpenses } = await import('../../utils/formatters.js');
const { i18n } = await import('../../config/i18n.js');
const { loggers } = await import('../../utils/logger.js');
const { generateDailyMessage } = await import('../../utils/utils.js');
// Not referenced directly; this wires up the mock above before adminCommands.js is imported.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { config } = await import('../../config/environment.js');
const { default: botAdminCommands } = await import('../../botsCommands/adminCommands.js');

describe('adminCommands', () => {
  let mockBot: {
    filter: jest.Mock;
    command: jest.Mock;
    callbackQuery: jest.Mock;
    api: { sendMessage: jest.Mock; pinChatMessage: jest.Mock };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handlers: Record<string, (...args: any[]) => any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let callbackHandlers: Record<string, (...args: any[]) => any> = {};
  const adminId = 123;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb = { prepare: jest.fn(), exec: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};
    callbackHandlers = {};
    process.env.ADMIN_IDS = `[${adminId}]`;
    process.env.ONBOARDING_SPREADSHEET_ID = 'test-sheet-id';
    process.env.GROUP_CHAT_ID = 'group-chat-123';
    process.env.MBWAY_NUMBER = '912345678';
    process.env.PAYPAL_ME_USERNAME = 'azeiteiro';
    process.env.BANK_IBAN = 'PT50000000000000000000000';

    mockBot = {
      filter: jest.fn().mockReturnThis(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: jest.fn((cmd: string, handler: (...args: any[]) => any) => {
        handlers[cmd] = handler;
      }) as unknown as jest.Mock,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callbackQuery: jest.fn((trigger: string, handler: (...args: any[]) => any) => {
        callbackHandlers[trigger] = handler;
      }) as unknown as jest.Mock,
      api: {
        sendMessage: jest.fn().mockResolvedValue({ message_id: 789 } as never),
        pinChatMessage: jest.fn().mockResolvedValue(true as never),
      },
    };

    botAdminCommands(mockBot as unknown as Bot<BotContext>, mockDb);
  });

  const createCtx = (userId: number, text: string = '') => ({
    from: { id: userId },
    message: { text },
    match: text.replace(/^\/\S+\s*/, ''),
    reply: jest.fn().mockReturnValue(Promise.resolve({ message_id: 456 })),
  });

  const createCallbackCtx = (
    userId: number,
    session: { pendingBroadcast?: string; pendingPinMessageId?: number } = {},
  ) => ({
    from: { id: userId },
    session,
    match: undefined,
    reply: jest.fn().mockReturnValue(Promise.resolve({ message_id: 456 })),
    answerCallbackQuery: jest.fn().mockResolvedValue({} as never),
    editMessageText: jest.fn().mockResolvedValue({} as never),
  });

  describe('create_album', () => {
    it('should reject non-admins', async () => {
      const ctx = createCtx(999);

      await handlers['create_album'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
    });

    it('should ask for album name if missing', async () => {
      const ctx = createCtx(adminId, '/create_album');

      await handlers['create_album'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('must specify an album name'));
    });

    it('should create album with valid name', async () => {
      const ctx = createCtx(adminId, '/create_album My New Album');

      (createAlbum as jest.Mock).mockResolvedValue('Album Created' as never);

      await handlers['create_album'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('Creating the album, please wait');
      expect(createAlbum).toHaveBeenCalledWith('My New Album');
      expect(ctx.reply).toHaveBeenCalledWith('Album Created');
    });

    it('should propagate reply failure for non-admins instead of leaving it unhandled', async () => {
      const ctx = createCtx(999);
      const error = new Error('telegram down');

      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['create_album'](ctx)).rejects.toThrow('telegram down');
    });

    it('should propagate reply failure for missing album name instead of leaving it unhandled', async () => {
      const ctx = createCtx(adminId, '/create_album');
      const error = new Error('telegram down');

      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['create_album'](ctx)).rejects.toThrow('telegram down');
    });

    it('should propagate reply failure after creating album instead of leaving it unhandled', async () => {
      const ctx = createCtx(adminId, '/create_album My New Album');
      const error = new Error('telegram down');

      (createAlbum as jest.Mock).mockResolvedValue('Album Created' as never);
      ctx.reply = jest.fn().mockResolvedValueOnce({ message_id: 1 }).mockRejectedValueOnce(error);

      await expect(handlers['create_album'](ctx)).rejects.toThrow('telegram down');
    });
  });

  describe('albums', () => {
    it('should list albums', async () => {
      const ctx = createCtx(adminId);

      (getAlbums as jest.Mock).mockResolvedValue([
        { title: 'Album 1' },
        { title: 'Album 2' },
      ] as never);

      await handlers['albums'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('Album 1\nAlbum 2\n');
    });

    it('should propagate reply failure instead of leaving it unhandled', async () => {
      const ctx = createCtx(adminId);
      const error = new Error('telegram down');

      (getAlbums as jest.Mock).mockResolvedValue([{ title: 'Album 1' }] as never);
      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['albums'](ctx)).rejects.toThrow('telegram down');
    });
  });

  describe('albumInfo', () => {
    it('should ask for album id if missing', async () => {
      const ctx = createCtx(adminId, '/albumInfo');

      await handlers['albumInfo'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('must specify an album id'));
    });

    it('should propagate reply failure when album id is missing', async () => {
      const ctx = createCtx(adminId, '/albumInfo');
      const error = new Error('telegram down');

      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['albumInfo'](ctx)).rejects.toThrow('telegram down');
    });

    it('should propagate reply failure for the initial "please wait" message', async () => {
      const ctx = createCtx(adminId, '/albumInfo album123');
      const error = new Error('telegram down');

      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['albumInfo'](ctx)).rejects.toThrow('telegram down');
    });

    it('should get album info with valid id', async () => {
      const ctx = createCtx(adminId, '/albumInfo album123');

      (getAlbumInfo as jest.Mock).mockResolvedValue({
        title: 'My Album',
        productUrl: 'http://url',
      } as never);

      await handlers['albumInfo'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('Getting album info, please wait');
      // Wait for promise
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getAlbumInfo).toHaveBeenCalledWith('album123');
      expect(ctx.reply).toHaveBeenCalledWith('Title: My Album - http://url', expect.any(Object));
    });

    it('should handle errors in getAlbumInfo', async () => {
      const ctx = createCtx(adminId, '/albumInfo album123');
      const error = new Error('API Error');

      (getAlbumInfo as jest.Mock).mockRejectedValue(error as never);

      await handlers['albumInfo'](ctx);

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(loggers.errorWithContext).toHaveBeenCalledWith(error, 'Google Photos API');
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Error getting album info'));
    });
  });

  describe('showexpenses', () => {
    it('should reject if spreadsheet id is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (process.env as any).ONBOARDING_SPREADSHEET_ID;
      const ctx = createCtx(adminId);

      await handlers['showexpenses'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Spreadsheet ID is not set'));
    });

    it('should propagate reply failure when spreadsheet id is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (process.env as any).ONBOARDING_SPREADSHEET_ID;
      const ctx = createCtx(adminId);
      const error = new Error('telegram down');

      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['showexpenses'](ctx)).rejects.toThrow('telegram down');
    });

    it('should propagate reply failure when showing formatted expenses', async () => {
      const ctx = createCtx(adminId);
      const error = new Error('telegram down');

      (getSheetData as jest.Mock).mockResolvedValue({ values: [['val1']] } as never);
      (formatExpenses as jest.Mock).mockReturnValue('Formatted Data');
      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['showexpenses'](ctx)).rejects.toThrow('telegram down');
    });

    it('should handle empty data', async () => {
      const ctx = createCtx(adminId);

      (getSheetData as jest.Mock).mockResolvedValue({ values: [] } as never);

      const result = await handlers['showexpenses'](ctx);

      expect(result).toEqual([]);
    });

    it('should show formatted expenses', async () => {
      const ctx = createCtx(adminId);

      (getSheetData as jest.Mock).mockResolvedValue({ values: [['val1']] } as never);
      (formatExpenses as jest.Mock).mockReturnValue('Formatted Data');

      await handlers['showexpenses'](ctx);

      expect(formatExpenses).toHaveBeenCalledWith([['val1']]);
      expect(ctx.reply).toHaveBeenCalledWith('Formatted Data', expect.any(Object));
    });
  });

  describe('testdailymessage', () => {
    it('should reject non-admins', async () => {
      const ctx = createCtx(999);

      await handlers['testdailymessage'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
    });

    it('should propagate reply failure for non-admins instead of leaving it unhandled', async () => {
      const ctx = createCtx(999);
      const error = new Error('telegram down');

      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['testdailymessage'](ctx)).rejects.toThrow('telegram down');
    });

    it('should generate daily message for admin', async () => {
      const ctx = createCtx(adminId);

      (generateDailyMessage as jest.Mock).mockResolvedValue(undefined as never);

      await handlers['testdailymessage'](ctx);
      expect(generateDailyMessage).toHaveBeenCalledWith(mockBot, adminId, true);
    });

    it('should reply with error if generateDailyMessage throws', async () => {
      const ctx = createCtx(adminId);
      const error = new Error('weather fetch failed');

      (generateDailyMessage as jest.Mock).mockRejectedValue(error as never);

      await handlers['testdailymessage'](ctx);
      expect(loggers.errorWithContext).toHaveBeenCalledWith(error, '/testdailymessage');
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('weather fetch failed'));
    });
  });

  describe('isAdmin helper (implicit)', () => {
    it('should handle invalid ADMIN_IDS JSON', async () => {
      process.env.ADMIN_IDS = 'invalid';
      const ctx = createCtx(adminId);
      // Calling any command that uses isAdmin

      await handlers['testdailymessage'](ctx);
      expect(loggers.errorWithContext).toHaveBeenCalledWith(expect.any(Error), 'Admin ID parsing');
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
    });
  });

  describe('users', () => {
    it('should reject non-admins', async () => {
      const ctx = createCtx(999);

      await handlers['users'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
    });

    it('should propagate reply failure for non-admins instead of leaving it unhandled', async () => {
      const ctx = createCtx(999);
      const error = new Error('telegram down');

      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['users'](ctx)).rejects.toThrow('telegram down');
    });

    it('should reply with no users message when table is empty', async () => {
      const ctx = createCtx(adminId);

      (getAllUsers as jest.Mock).mockReturnValue([] as never);

      await handlers['users'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith('No users found.');
    });

    it('should propagate reply failure when table is empty', async () => {
      const ctx = createCtx(adminId);
      const error = new Error('telegram down');

      (getAllUsers as jest.Mock).mockReturnValue([] as never);
      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['users'](ctx)).rejects.toThrow('telegram down');
    });

    it('should reply with a Telegram-safe HTML formatted user list', async () => {
      const ctx = createCtx(adminId);

      (getAllUsers as jest.Mock).mockReturnValue([
        { name: 'Alice', telegram_username: 'alice', onboarding_status: 'COMPLETED' },
        { name: 'Bob', telegram_username: null, onboarding_status: 'WAITING_PAYMENT' },
        { name: null, telegram_username: 'charlie', onboarding_status: 'STARTED' },
        { name: 'Dave', telegram_username: 'dave', onboarding_status: 'UNKNOWN' },
      ] as never);

      await handlers['users'](ctx);

      const [message, options] = ctx.reply.mock.calls[0];

      expect(options).toEqual({ parse_mode: 'HTML' });
      expect(message).toContain('Users (4)');
      expect(message).toContain('✅');
      expect(message).toContain('Alice');
      expect(message).toContain('@alice');
      expect(message).toContain('💳');
      expect(message).toContain('Bob');
      expect(message).toContain('⏳');
      expect(message).toContain('@charlie');
      expect(message).toContain('❓');
      // Telegram's HTML parse_mode doesn't support table/list tags
      expect(message).not.toContain('<table>');
      expect(message).not.toContain('<th>');
      expect(message).not.toContain('<ul>');
    });

    it('should escape HTML special characters in a user name so Telegram can parse the message', async () => {
      const ctx = createCtx(adminId);

      (getAllUsers as jest.Mock).mockReturnValue([
        { name: '<b>Alice</b> & Co', telegram_username: 'alice', onboarding_status: 'COMPLETED' },
      ] as never);

      await handlers['users'](ctx);

      const [message] = ctx.reply.mock.calls[0];

      expect(message).not.toContain('<b>Alice</b> & Co');
      expect(message).toContain('&lt;b&gt;Alice&lt;/b&gt; &amp; Co');
    });

    it('should propagate reply failure for the user list instead of leaving it unhandled', async () => {
      const ctx = createCtx(adminId);
      const error = new Error('telegram down');

      (getAllUsers as jest.Mock).mockReturnValue([
        { name: 'Alice', telegram_username: 'alice', onboarding_status: 'COMPLETED' },
      ] as never);
      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['users'](ctx)).rejects.toThrow('telegram down');
    });
  });

  describe('offboarding1', () => {
    it('should reject non-admins', async () => {
      const ctx = createCtx(999);

      await handlers['offboarding1'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
    });

    it('should propagate reply failure for non-admins instead of leaving it unhandled', async () => {
      const ctx = createCtx(999);
      const error = new Error('telegram down');

      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['offboarding1'](ctx)).rejects.toThrow('telegram down');
    });

    it('should reply if GROUP_CHAT_ID is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (process.env as any).GROUP_CHAT_ID;
      const ctx = createCtx(adminId);

      await handlers['offboarding1'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith('GROUP_CHAT_ID is not set.');
    });

    it('should propagate reply failure when GROUP_CHAT_ID is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (process.env as any).GROUP_CHAT_ID;
      const ctx = createCtx(adminId);
      const error = new Error('telegram down');

      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['offboarding1'](ctx)).rejects.toThrow('telegram down');
    });

    it('should abort if group message send fails', async () => {
      const ctx = createCtx(adminId);

      mockBot.api.sendMessage.mockRejectedValueOnce(new Error('network error') as never);

      await handlers['offboarding1'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith('Failed to send group message.');
    });

    it('should send group message and DMs, report summary', async () => {
      const ctx = createCtx(adminId);

      (getAllCompletedUsers as jest.Mock).mockReturnValue([
        { user_id: 1, name: 'Alice', telegram_username: 'alice', preferred_language: 'en' },
        { user_id: 2, name: null, telegram_username: 'bob', preferred_language: 'pt' },
      ] as never);

      await handlers['offboarding1'](ctx);

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith('group-chat-123', 'mocked translation');
      expect(mockBot.api.sendMessage).toHaveBeenCalledTimes(3); // group + 2 DMs
      expect(ctx.reply).toHaveBeenCalledWith('mocked translation');
    });

    it('should count failed DMs in summary', async () => {
      const ctx = createCtx(adminId);

      (getAllCompletedUsers as jest.Mock).mockReturnValue([
        { user_id: 1, name: 'Alice', telegram_username: null, preferred_language: 'en' },
      ] as never);
      // group message succeeds, DM fails
      mockBot.api.sendMessage
        .mockResolvedValueOnce({} as never)
        .mockRejectedValueOnce(new Error('blocked') as never);

      await handlers['offboarding1'](ctx);

      expect(loggers.errorWithContext).toHaveBeenCalledWith(
        expect.any(Error),
        '/offboarding1 DM to user 1',
      );
      expect(ctx.reply).toHaveBeenCalledWith('mocked translation');
    });
  });

  describe('offboarding2', () => {
    it('should reject non-admins', async () => {
      const ctx = createCtx(999);

      await handlers['offboarding2'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
    });

    it('should propagate reply failure for non-admins instead of leaving it unhandled', async () => {
      const ctx = createCtx(999);
      const error = new Error('telegram down');

      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['offboarding2'](ctx)).rejects.toThrow('telegram down');
    });

    it('should reply with error if sheet read fails', async () => {
      const ctx = createCtx(adminId);

      (getOffboardingBalances as jest.Mock).mockRejectedValue(new Error('sheet error') as never);

      await handlers['offboarding2'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read offboarding sheet'),
      );
    });

    it('should send balance messages and summary for positive and negative amounts', async () => {
      const ctx = createCtx(adminId);

      (getOffboardingBalances as jest.Mock).mockResolvedValue(
        new Map([
          [1, 50.0],
          [2, -30.0],
        ]) as never,
      );
      (getUserById as jest.Mock).mockReturnValue({ preferred_language: 'en' } as never);

      await handlers['offboarding2'](ctx);

      expect(mockBot.api.sendMessage).toHaveBeenCalledTimes(2);
      expect(ctx.reply).toHaveBeenCalledWith('mocked translation');
    });

    it('should count failed DMs in summary', async () => {
      const ctx = createCtx(adminId);

      (getOffboardingBalances as jest.Mock).mockResolvedValue(new Map([[1, 20.0]]) as never);
      (getUserById as jest.Mock).mockReturnValue({ preferred_language: 'pt' } as never);
      mockBot.api.sendMessage.mockRejectedValueOnce(new Error('blocked') as never);

      await handlers['offboarding2'](ctx);

      expect(loggers.errorWithContext).toHaveBeenCalledWith(
        expect.any(Error),
        '/offboarding2 DM to user 1',
      );
      expect(ctx.reply).toHaveBeenCalledWith('mocked translation');
    });
  });

  describe('offboarding3', () => {
    it('should reject non-admins', async () => {
      const ctx = createCtx(999);

      await handlers['offboarding3'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
    });

    it('should propagate reply failure for non-admins instead of leaving it unhandled', async () => {
      const ctx = createCtx(999);
      const error = new Error('telegram down');

      ctx.reply = jest.fn().mockRejectedValue(error);

      await expect(handlers['offboarding3'](ctx)).rejects.toThrow('telegram down');
    });

    it('should reply with error if sheet read fails', async () => {
      const ctx = createCtx(adminId);

      (getOffboardingBalances as jest.Mock).mockRejectedValue(new Error('sheet error') as never);

      await handlers['offboarding3'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read offboarding sheet'),
      );
    });

    it('should send final messages for positive and negative amounts', async () => {
      const ctx = createCtx(adminId);

      (getOffboardingBalances as jest.Mock).mockResolvedValue(
        new Map([
          [1, 100.0],
          [2, -25.5],
        ]) as never,
      );
      (getUserById as jest.Mock).mockReturnValue({ preferred_language: 'en' } as never);

      await handlers['offboarding3'](ctx);

      expect(mockBot.api.sendMessage).toHaveBeenCalledTimes(2);
      expect(ctx.reply).toHaveBeenCalledWith('mocked translation');

      // User 1 is owed money: no payment buttons.
      const receiveOptions = mockBot.api.sendMessage.mock.calls[0][2] as {
        parse_mode: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reply_markup?: any;
      };

      expect(receiveOptions.reply_markup).toBeUndefined();

      // User 2 owes money: Revolut + PayPal buttons, pre-filled with their amount.
      const payOptions = mockBot.api.sendMessage.mock.calls[1][2] as {
        parse_mode: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reply_markup: any;
      };
      const buttons = payOptions.reply_markup.inline_keyboard[0];

      expect(buttons[0].url).toContain('PDC_2026_Settlement_');
      expect(buttons[1].url).toBe('https://paypal.me/azeiteiro/25.50EUR');

      const payTranslateCall = (i18n.translate as jest.Mock).mock.calls.find(
        (call) => call[1] === 'offboarding-final-pay',
      );

      expect(payTranslateCall?.[2]).toEqual({
        amount: '25.50',
        mbwayNumber: '912345678',
        iban: 'PT50000000000000000000000',
      });
    });

    it('should count failed DMs in summary', async () => {
      const ctx = createCtx(adminId);

      (getOffboardingBalances as jest.Mock).mockResolvedValue(new Map([[99, -10.0]]) as never);
      (getUserById as jest.Mock).mockReturnValue(undefined as never);
      mockBot.api.sendMessage.mockRejectedValueOnce(new Error('blocked') as never);

      await handlers['offboarding3'](ctx);

      expect(loggers.errorWithContext).toHaveBeenCalledWith(
        expect.any(Error),
        '/offboarding3 DM to user 99',
      );
      expect(ctx.reply).toHaveBeenCalledWith('mocked translation');
    });
  });

  describe('announce', () => {
    it('should reject non-admins', async () => {
      const ctx = createCtx(999, '/announce Hello group');

      await handlers['announce'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
    });

    it('should ask for a message if none is provided', async () => {
      const ctx = createCtx(adminId, '/announce');

      await handlers['announce'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('You must include a message'));
    });

    it('should store the message in session and reply with a preview and keyboard', async () => {
      const ctx = createCtx(adminId, '/announce Party tonight at *9pm*!');

      (ctx as unknown as { session: { pendingBroadcast?: string } }).session = {};

      await handlers['announce'](ctx);

      expect(
        (ctx as unknown as { session: { pendingBroadcast?: string } }).session.pendingBroadcast,
      ).toBe('Party tonight at *9pm*!');

      const [message, options] = ctx.reply.mock.calls[0];

      expect(message).toContain('Party tonight at *9pm*!');
      expect(options).toEqual(
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.objectContaining({
            inline_keyboard: [
              [
                expect.objectContaining({ callback_data: 'announce_confirm' }),
                expect.objectContaining({ callback_data: 'announce_confirm_pin' }),
              ],
              [expect.objectContaining({ callback_data: 'announce_cancel' })],
            ],
          }),
        }),
      );
    });

    it('should preserve multi-line messages', async () => {
      const ctx = createCtx(adminId, '/announce Line one\nLine two');

      (ctx as unknown as { session: { pendingBroadcast?: string } }).session = {};

      await handlers['announce'](ctx);

      expect(
        (ctx as unknown as { session: { pendingBroadcast?: string } }).session.pendingBroadcast,
      ).toBe('Line one\nLine two');
    });

    it('should overwrite a previous pending broadcast on a second /announce', async () => {
      const ctx = createCtx(adminId, '/announce Second message');

      (ctx as unknown as { session: { pendingBroadcast?: string } }).session = {
        pendingBroadcast: 'First message',
      };

      await handlers['announce'](ctx);

      expect(
        (ctx as unknown as { session: { pendingBroadcast?: string } }).session.pendingBroadcast,
      ).toBe('Second message');
    });

    describe('announce_confirm callback', () => {
      it('should reject non-admins', async () => {
        const ctx = createCallbackCtx(999, { pendingBroadcast: 'Hello' });

        await callbackHandlers['announce_confirm'](ctx);
        expect(ctx.answerCallbackQuery).toHaveBeenCalledWith("You're not allowed to do that");
        expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
      });

      it('should be a no-op when there is no pending broadcast', async () => {
        const ctx = createCallbackCtx(adminId, {});

        await callbackHandlers['announce_confirm'](ctx);

        expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Nothing pending'),
        );
      });

      it('should send the pending broadcast to the group and clear it', async () => {
        const ctx = createCallbackCtx(adminId, { pendingBroadcast: 'Party tonight at *9pm*!' });

        await callbackHandlers['announce_confirm'](ctx);

        expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
          'group-chat-123',
          'Party tonight at *9pm*!',
          { parse_mode: 'Markdown' },
        );
        expect(ctx.session.pendingBroadcast).toBeUndefined();
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Sent to the group'),
        );
      });

      it('should report a failure and clear the pending broadcast if sendMessage rejects', async () => {
        const ctx = createCallbackCtx(adminId, { pendingBroadcast: 'Party tonight!' });

        mockBot.api.sendMessage.mockRejectedValueOnce(new Error('network error') as never);

        await callbackHandlers['announce_confirm'](ctx);

        expect(loggers.errorWithContext).toHaveBeenCalledWith(
          expect.any(Error),
          '/announce group send',
        );
        expect(ctx.session.pendingBroadcast).toBeUndefined();
        expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining('Failed to send'));
      });
    });

    describe('announce_confirm_pin callback', () => {
      it('should reject non-admins', async () => {
        const ctx = createCallbackCtx(999, { pendingBroadcast: 'Hello' });

        await callbackHandlers['announce_confirm_pin'](ctx);
        expect(ctx.answerCallbackQuery).toHaveBeenCalledWith("You're not allowed to do that");
        expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
      });

      it('should be a no-op when there is no pending broadcast', async () => {
        const ctx = createCallbackCtx(adminId, {});

        await callbackHandlers['announce_confirm_pin'](ctx);

        expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Nothing pending'),
        );
      });

      it('should send the pending broadcast, store the sent message id, and ask to pin', async () => {
        const ctx = createCallbackCtx(adminId, { pendingBroadcast: 'Party tonight at *9pm*!' });

        await callbackHandlers['announce_confirm_pin'](ctx);

        expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
          'group-chat-123',
          'Party tonight at *9pm*!',
          { parse_mode: 'Markdown' },
        );
        expect(ctx.session.pendingBroadcast).toBeUndefined();
        expect(ctx.session.pendingPinMessageId).toBe(789);
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Pin this message?'),
          expect.objectContaining({
            reply_markup: expect.objectContaining({
              inline_keyboard: [
                [
                  expect.objectContaining({ callback_data: 'announce_pin_notify' }),
                  expect.objectContaining({ callback_data: 'announce_pin_silent' }),
                ],
              ],
            }),
          }),
        );
      });

      it('should report a failure and clear the pending broadcast if sendMessage rejects', async () => {
        const ctx = createCallbackCtx(adminId, { pendingBroadcast: 'Party tonight!' });

        mockBot.api.sendMessage.mockRejectedValueOnce(new Error('network error') as never);

        await callbackHandlers['announce_confirm_pin'](ctx);

        expect(loggers.errorWithContext).toHaveBeenCalledWith(
          expect.any(Error),
          '/announce group send',
        );
        expect(ctx.session.pendingBroadcast).toBeUndefined();
        expect(ctx.session.pendingPinMessageId).toBeUndefined();
        expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining('Failed to send'));
      });
    });

    describe('announce_pin_notify / announce_pin_silent callbacks', () => {
      it('should reject non-admins on announce_pin_notify', async () => {
        const ctx = createCallbackCtx(999, { pendingPinMessageId: 789 });

        await callbackHandlers['announce_pin_notify'](ctx);
        expect(ctx.answerCallbackQuery).toHaveBeenCalledWith("You're not allowed to do that");
        expect(mockBot.api.pinChatMessage).not.toHaveBeenCalled();
      });

      it('should reject non-admins on announce_pin_silent', async () => {
        const ctx = createCallbackCtx(999, { pendingPinMessageId: 789 });

        await callbackHandlers['announce_pin_silent'](ctx);
        expect(ctx.answerCallbackQuery).toHaveBeenCalledWith("You're not allowed to do that");
        expect(mockBot.api.pinChatMessage).not.toHaveBeenCalled();
      });

      it('should be a no-op when there is no pending pin', async () => {
        const ctx = createCallbackCtx(adminId, {});

        await callbackHandlers['announce_pin_notify'](ctx);

        expect(mockBot.api.pinChatMessage).not.toHaveBeenCalled();
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Nothing pending'),
        );
      });

      it('should pin with a notification and clear the pending pin on announce_pin_notify', async () => {
        const ctx = createCallbackCtx(adminId, { pendingPinMessageId: 789 });

        await callbackHandlers['announce_pin_notify'](ctx);

        expect(mockBot.api.pinChatMessage).toHaveBeenCalledWith('group-chat-123', 789, {
          disable_notification: false,
        });
        expect(ctx.session.pendingPinMessageId).toBeUndefined();
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Sent to the group and pinned'),
        );
      });

      it('should pin silently and clear the pending pin on announce_pin_silent', async () => {
        const ctx = createCallbackCtx(adminId, { pendingPinMessageId: 789 });

        await callbackHandlers['announce_pin_silent'](ctx);

        expect(mockBot.api.pinChatMessage).toHaveBeenCalledWith('group-chat-123', 789, {
          disable_notification: true,
        });
        expect(ctx.session.pendingPinMessageId).toBeUndefined();
        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('Sent to the group and pinned'),
        );
      });

      it('should report the broadcast as sent but note the pin failure if pinChatMessage rejects', async () => {
        const ctx = createCallbackCtx(adminId, { pendingPinMessageId: 789 });

        mockBot.api.pinChatMessage.mockRejectedValueOnce(new Error('not enough rights') as never);

        await callbackHandlers['announce_pin_notify'](ctx);

        expect(loggers.errorWithContext).toHaveBeenCalledWith(
          expect.any(Error),
          '/announce group pin',
        );
        expect(ctx.session.pendingPinMessageId).toBeUndefined();
        expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining('pin failed'));
      });
    });

    describe('announce_cancel callback', () => {
      it('should reject non-admins', async () => {
        const ctx = createCallbackCtx(999, { pendingBroadcast: 'Hello' });

        await callbackHandlers['announce_cancel'](ctx);
        expect(ctx.answerCallbackQuery).toHaveBeenCalledWith("You're not allowed to do that");
        expect(ctx.editMessageText).not.toHaveBeenCalled();
      });

      it('should clear the pending broadcast and confirm cancellation', async () => {
        const ctx = createCallbackCtx(adminId, { pendingBroadcast: 'Party tonight!' });

        await callbackHandlers['announce_cancel'](ctx);

        expect(ctx.session.pendingBroadcast).toBeUndefined();
        expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
        expect(ctx.editMessageText).toHaveBeenCalledWith('❌ Cancelled.');
      });
    });
  });
});
