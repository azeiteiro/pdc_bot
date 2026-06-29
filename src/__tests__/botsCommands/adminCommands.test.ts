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

jest.unstable_mockModule('../../utils/dataLoader.js', () => ({
  getResourcePath: jest.fn().mockReturnValue('/fake/path/test.html'),
}));

jest.unstable_mockModule('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('<html>test</html>'),
}));

import { Bot } from 'grammy';
import { BotContext } from '../../types/types.js';

const { createAlbum, getAlbums, getAlbumInfo } = await import('../../googleApi/googlePhotosAPI.js');
const { getSheetData, getOffboardingBalances } = await import('../../googleApi/googleSheetsApi.js');
const { getAllUsers, getAllCompletedUsers, getUserById } =
  await import('../../storage/userRepository.js');
const { formatExpenses } = await import('../../utils/formatters.js');
const { loggers } = await import('../../utils/logger.js');
const { generateDailyMessage } = await import('../../utils/utils.js');
const { readFileSync } = await import('fs');
const { default: botAdminCommands } = await import('../../botsCommands/adminCommands.js');

describe('adminCommands', () => {
  let mockBot: { filter: jest.Mock; command: jest.Mock; api: { sendMessage: jest.Mock } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handlers: Record<string, (...args: any[]) => any> = {};
  const adminId = 123;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb = { prepare: jest.fn(), exec: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};
    process.env.ADMIN_IDS = `[${adminId}]`;
    process.env.ONBOARDING_SPREADSHEET_ID = 'test-sheet-id';
    process.env.GROUP_CHAT_ID = 'group-chat-123';
    process.env.MBWAY_NUMBER = '912345678';

    mockBot = {
      filter: jest.fn().mockReturnThis(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: jest.fn((cmd: string, handler: (...args: any[]) => any) => {
        handlers[cmd] = handler;
      }) as unknown as jest.Mock,
      api: {
        sendMessage: jest.fn().mockResolvedValue({} as never),
      },
    };

    botAdminCommands(mockBot as unknown as Bot<BotContext>, mockDb);
  });

  const createCtx = (userId: number, text: string = '') => ({
    from: { id: userId },
    message: { text },
    reply: jest.fn().mockReturnValue(Promise.resolve({ message_id: 456 })),
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
      // Wait for promise
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(createAlbum).toHaveBeenCalledWith('My New Album');
      expect(ctx.reply).toHaveBeenCalledWith('Album Created');
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

      // Wait for promise
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(ctx.reply).toHaveBeenCalledWith('Album 1\nAlbum 2\n');
    });
  });

  describe('albumInfo', () => {
    it('should ask for album id if missing', async () => {
      const ctx = createCtx(adminId, '/albumInfo');

      await handlers['albumInfo'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('must specify an album id'));
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
    const createCtxWithRichApi = (userId: number) => {
      const sendRichMessage = jest.fn().mockResolvedValue({} as never);

      return {
        ...createCtx(userId),
        chat: { id: 99 },
        api: { raw: { sendRichMessage } },
        sendRichMessage, // shortcut for assertions
      };
    };

    it('should reject non-admins', async () => {
      const ctx = createCtx(999);

      await handlers['users'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
    });

    it('should reply with no users message when table is empty', async () => {
      const ctx = createCtx(adminId);

      (getAllUsers as jest.Mock).mockReturnValue([] as never);

      await handlers['users'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith('No users found.');
    });

    it('should send a rich text table with correct status icons', async () => {
      const ctx = createCtxWithRichApi(adminId);

      (getAllUsers as jest.Mock).mockReturnValue([
        { name: 'Alice', telegram_username: 'alice', onboarding_status: 'COMPLETED' },
        { name: 'Bob', telegram_username: null, onboarding_status: 'WAITING_PAYMENT' },
        { name: null, telegram_username: 'charlie', onboarding_status: 'STARTED' },
        { name: 'Dave', telegram_username: 'dave', onboarding_status: 'UNKNOWN' },
      ] as never);

      await handlers['users'](ctx);

      const { html } = ctx.sendRichMessage.mock.calls[0][0].rich_message;

      expect(html).toContain('Users (4)');
      expect(html).toContain('✅');
      expect(html).toContain('Alice');
      expect(html).toContain('@alice');
      expect(html).toContain('💳');
      expect(html).toContain('Bob');
      expect(html).toContain('⏳');
      expect(html).toContain('@charlie');
      expect(html).toContain('❓');
      expect(html).toContain('<table>');
      expect(html).toContain('<th>Name</th>');
      expect(html).toContain('Completed');
      expect(html).toContain('Waiting payment');
      expect(html).toContain('Started');
    });

    it('should reply with error if sendRichMessage throws', async () => {
      const ctx = createCtxWithRichApi(adminId);

      ctx.sendRichMessage.mockRejectedValueOnce(new Error('API fail') as never);
      (getAllUsers as jest.Mock).mockReturnValue([
        { name: 'Alice', telegram_username: 'alice', onboarding_status: 'COMPLETED' },
      ] as never);

      await handlers['users'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith('Error: API fail');
    });
  });

  describe('offboarding1', () => {
    it('should reject non-admins', async () => {
      const ctx = createCtx(999);

      await handlers['offboarding1'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
    });

    it('should reply if GROUP_CHAT_ID is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (process.env as any).GROUP_CHAT_ID;
      const ctx = createCtx(adminId);

      await handlers['offboarding1'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith('GROUP_CHAT_ID is not set.');
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

  describe('textformat', () => {
    it('should reject non-admins', async () => {
      const ctx = createCtx(999);

      await handlers['textformat'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
    });

    it('should send rich message for admin', async () => {
      const sendRichMessage = jest.fn().mockResolvedValue({} as never);
      const ctx = {
        ...createCtx(adminId),
        chat: { id: 42 },
        api: { raw: { sendRichMessage } },
      };

      await handlers['textformat'](ctx);
      expect(readFileSync).toHaveBeenCalled();
      expect(sendRichMessage).toHaveBeenCalledWith({
        chat_id: 42,
        rich_message: { html: '<html>test</html>' },
      });
    });

    it('should reply with error if sendRichMessage throws', async () => {
      const ctx = {
        ...createCtx(adminId),
        chat: { id: 42 },
        api: {
          raw: { sendRichMessage: jest.fn().mockRejectedValue(new Error('API fail') as never) },
        },
      };

      await handlers['textformat'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith('Error: API fail');
    });
  });
});
