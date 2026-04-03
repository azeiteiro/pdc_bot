import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../../googleApi/googlePhotosAPI.js', () => ({
  createAlbum: jest.fn(),
  getAlbums: jest.fn(),
  getAlbumInfo: jest.fn(),
}));

jest.unstable_mockModule('../../googleApi/googleSheetsApi.js', () => ({
  getSheetData: jest.fn(),
}));

jest.unstable_mockModule('../../utils/formatters.js', () => ({
  formatExpenses: jest.fn(),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  loggers: {
    botResponse: jest.fn(),
    errorWithContext: jest.fn(),
  },
}));

jest.unstable_mockModule('../../utils/utils.js', () => ({
  generateDailyMessage: jest.fn(),
}));

import { Bot } from 'grammy';
import { BotContext } from '../../types/types.js';

const { createAlbum, getAlbums, getAlbumInfo } = await import('../../googleApi/googlePhotosAPI.js');
const { getSheetData } = await import('../../googleApi/googleSheetsApi.js');
const { formatExpenses } = await import('../../utils/formatters.js');
const { loggers } = await import('../../utils/logger.js');
const { generateDailyMessage } = await import('../../utils/utils.js');
const { default: botAdminCommands } = await import('../../botsCommands/adminCommands.js');

describe('adminCommands', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockBot: { command: jest.Mock<any> };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handlers: Record<string, (...args: any[]) => any> = {};
  const adminId = 123;

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};
    process.env.ADMIN_IDS = `[${adminId}]`;
    process.env.GOOGLE_SPREADSHEET_ID = 'test-sheet-id';

    mockBot = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: jest.fn((cmd: string, handler: (...args: any[]) => any) => {
        handlers[cmd] = handler;
      }) as unknown as jest.Mock,
    };

    botAdminCommands(mockBot as unknown as Bot<BotContext>);
  });

  const createCtx = (userId: number, text: string = '') => ({
    from: { id: userId },
    message: { text },
    reply: jest.fn().mockReturnValue(Promise.resolve({ message_id: 456 })),
  });

  describe('createAlbum', () => {
    it('should reject non-admins', async () => {
      const ctx = createCtx(999);

      await handlers['createAlbum'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
    });

    it('should ask for album name if missing', async () => {
      const ctx = createCtx(adminId, '/createAlbum');

      await handlers['createAlbum'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('must specify an album name'));
    });

    it('should create album with valid name', async () => {
      const ctx = createCtx(adminId, '/createAlbum My New Album');

      (createAlbum as jest.Mock).mockResolvedValue('Album Created' as never);

      await handlers['createAlbum'](ctx);

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
      delete process.env.GOOGLE_SPREADSHEET_ID;
      const ctx = createCtx(adminId);

      await handlers['showexpenses'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Spreadsheet ID is not set'));
    });

    it('should reject non-admins', async () => {
      const ctx = createCtx(999);

      await handlers['showexpenses'](ctx);
      expect(ctx.reply).toHaveBeenCalledWith("You're not allowed to do that");
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

      await handlers['testdailymessage'](ctx);
      expect(generateDailyMessage).toHaveBeenCalledWith(mockBot, adminId, true);
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
});
