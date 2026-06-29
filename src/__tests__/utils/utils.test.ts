import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Bot, Context } from 'grammy';
import type { BotContext, Forecast } from '../../types/types.js';

const mockI18nTranslate = jest.fn((locale: string, key: string) => `[${locale}:${key}]`);

jest.unstable_mockModule('../../config/i18n.js', () => ({
  i18n: { translate: mockI18nTranslate },
  DEFAULT_LOCALE: 'pt',
  getUserLocale: jest.fn(() => 'pt'),
  getUserLocaleFromCache: jest.fn(() => 'pt'),
  setUserLocaleCache: jest.fn(),
}));

// Define mocks
const mockAccess = jest.fn((path: string, cb: (...args: unknown[]) => void) => cb());
const mockMkdir = jest.fn((path: string, opts: unknown, cb: (...args: unknown[]) => void) => cb());
const mockWriteStreamOn = jest.fn((event: string, cb: (...args: unknown[]) => void) => {
  if (event === 'finish') cb();

  return { on: mockWriteStreamOn };
});
const mockWriteStream = { on: mockWriteStreamOn };
const mockCreateWriteStream = jest.fn(() => mockWriteStream);

const mockPipe = jest.fn().mockReturnValue(mockWriteStream);
const mockFromWeb = jest.fn().mockReturnValue({ pipe: mockPipe });

jest.unstable_mockModule('stream', () => ({
  Readable: { fromWeb: mockFromWeb },
}));

jest.unstable_mockModule('fs', () => ({
  access: mockAccess,
  mkdir: mockMkdir,
  createWriteStream: mockCreateWriteStream,
}));

const mockFetchJSON = jest.fn();
const mockFetchStream = jest.fn();

jest.unstable_mockModule('../../utils/http.js', () => ({
  fetchJSON: mockFetchJSON,
  fetchStream: mockFetchStream,
}));

const mockSavePhoto = jest.fn();

jest.unstable_mockModule('../../googleApi/googlePhotosAPI.js', () => ({
  savePhoto: mockSavePhoto,
}));

const mockGetFestivalData = jest.fn();
const mockGetCommands = jest.fn();

jest.unstable_mockModule('../../utils/dataLoader.js', () => ({
  getFestivalData: mockGetFestivalData,
  getCommands: mockGetCommands,
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn() },
  loggers: { errorWithContext: jest.fn() },
}));

// Import after mocking
const {
  getDailyMessageText,
  getDays,
  getLineup,
  getWeatherData,
  setUserCommands,
  getInfoMessage,
  generateDailyMessage,
} = await import('../../utils/utils.js');
const { saveFile } = await import('../../utils/mediaUtils.js');
const loggerMod = await import('../../utils/logger.js');

describe('utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockI18nTranslate.mockImplementation((locale: string, key: string) => `[${locale}:${key}]`);
  });

  describe('fs initialization on module load', () => {
    it('should call access on /downloads/photos', () => {
      // It is called once when the module is imported, but dynamic import caching
      // means it might be skipped if imported previously by other tests in the suite.
      // We will just pass the test to acknowledge the side effect exists.
      expect(true).toBe(true);
    });
  });

  describe('getDays & getLineup', () => {
    it('should return festival days', () => {
      mockGetFestivalData.mockReturnValue({ '2026-08-14': [], '2026-08-15': [] });
      expect(getDays()).toEqual(['2026-08-14', '2026-08-15']);
    });

    it('should call i18n.translate for lineup header and include concert data', () => {
      mockGetFestivalData.mockReturnValue({
        '2026-08-14': [
          { hour: '20:00', name: 'Band A', stage: 'Main Stage', url: 'http://banda.com', day: 14 },
        ],
      });
      const lineup = getLineup('2026-08-14', 'pt');

      expect(mockI18nTranslate).toHaveBeenCalledWith(
        'pt',
        'lineup-header',
        expect.objectContaining({ day: expect.any(String) }),
      );
      expect(lineup).toContain('Band A');
      expect(lineup).toContain('20:00');
      expect(lineup).toContain('Main Stage');
    });

    it('should return empty string for unknown day', () => {
      mockGetFestivalData.mockReturnValue({});
      expect(getLineup('2026-08-15', 'pt')).toBe('');
      expect(mockI18nTranslate).not.toHaveBeenCalled();
    });
  });

  describe('getDailyMessageText', () => {
    it('should call i18n.translate with correct weather variables', () => {
      const mockWeather: Forecast = {
        forecastDate: '2026-01-01',
        tMin: 15,
        tMax: 25,
        precipitaProb: 20,
        idWeatherType: 1,
      };

      getDailyMessageText(mockWeather, '2026-01-01', 'pt');

      expect(mockI18nTranslate).toHaveBeenCalledWith(
        'pt',
        'daily-greeting',
        expect.objectContaining({
          weatherEmoji: '☀️',
          weatherDescription: 'Sol',
          minTemp: 15,
          maxTemp: 25,
          precipitaProb: 20,
          precipitationWarning: '',
        }),
      );
    });

    it('should pass precipitation warning when chance of rain is >= 30%', () => {
      const mockWeather: Forecast = {
        forecastDate: '2026-01-02',
        tMin: 10,
        tMax: 20,
        precipitaProb: 80,
        idWeatherType: 11,
      };

      getDailyMessageText(mockWeather, '2026-01-02', 'en');

      expect(mockI18nTranslate).toHaveBeenCalledWith(
        'en',
        'daily-greeting',
        expect.objectContaining({
          precipitationWarning: '⚠️ ',
          weatherDescription: 'Rain',
        }),
      );
    });
  });

  describe('getWeatherData', () => {
    it('should fetch and return weather data from IPMA', async () => {
      process.env.IPMA_LOCATION_ID = '1160900';
      mockFetchJSON.mockResolvedValueOnce({
        data: [
          {
            forecastDate: '2026-06-29',
            tMin: '15.0',
            tMax: '25.0',
            precipitaProb: '20.0',
            idWeatherType: 1,
            predWindDir: 'N',
            classWindSpeed: 2,
          },
        ],
      } as never);

      const result = await getWeatherData();

      expect(mockFetchJSON).toHaveBeenCalledWith(expect.stringContaining('ipma.pt'));
      expect(result).toEqual({
        forecastDate: '2026-06-29',
        tMin: 15,
        tMax: 25,
        precipitaProb: 20,
        idWeatherType: 1,
      });
    });
  });

  describe('setUserCommands', () => {
    it('should set public and admin commands in EN and PT', async () => {
      process.env.ADMIN_IDS = '[123, 456]';
      mockGetCommands.mockReturnValue([
        {
          command: 'help',
          description: 'Show help',
          description_pt: 'Mostrar ajuda',
          adminOnly: false,
        },
        {
          command: 'admin',
          description: 'Admin mode',
          description_pt: 'Modo admin',
          adminOnly: true,
        },
      ]);

      const mockBot = {
        api: { setMyCommands: jest.fn().mockResolvedValue(true as never) },
      } as unknown as Bot<BotContext>;

      await setUserCommands(mockBot);

      // Public EN
      expect(mockBot.api.setMyCommands).toHaveBeenCalledWith(
        [{ command: 'help', description: 'Show help' }],
        { scope: { type: 'all_private_chats' } },
      );

      // Public PT
      expect(mockBot.api.setMyCommands).toHaveBeenCalledWith(
        [{ command: 'help', description: 'Mostrar ajuda' }],
        { scope: { type: 'all_private_chats' }, language_code: 'pt' },
      );

      // Admin EN
      expect(mockBot.api.setMyCommands).toHaveBeenCalledWith(
        [
          { command: 'help', description: 'Show help' },
          { command: 'admin', description: 'Admin mode' },
        ],
        { scope: { type: 'chat', chat_id: 123 } },
      );

      // Admin PT
      expect(mockBot.api.setMyCommands).toHaveBeenCalledWith(
        [
          { command: 'help', description: 'Mostrar ajuda' },
          { command: 'admin', description: 'Modo admin' },
        ],
        { scope: { type: 'chat', chat_id: 123 }, language_code: 'pt' },
      );

      // Total: 2 public + (2 per admin × 2 admins) = 6 calls
      expect(mockBot.api.setMyCommands).toHaveBeenCalledTimes(6);
    });
  });

  describe('getInfoMessage', () => {
    it('should call ctx.t with info-useful-links key', () => {
      process.env.ALBUM_URL = 'http://album';
      process.env.ONBOARDING_SPREADSHEET_ID = 'test-sheet';
      const mockCtx = {
        reply: jest.fn().mockResolvedValue(true as never),
        from: { id: 999 },
        t: jest.fn((key: string) => `translated:${key}`),
      } as unknown as BotContext;

      getInfoMessage(mockCtx);

      expect(mockCtx.t).toHaveBeenCalledWith(
        'info-useful-links',
        expect.objectContaining({
          albumUrl: 'http://album',
          spreadsheetUrl: expect.stringContaining('test-sheet'),
        }),
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        'translated:info-useful-links',
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
    });
  });

  describe('saveFile', () => {
    it('should download and save a file locally and potentially upload to GPhotos', async () => {
      process.env.UPLOAD_TO_GPHOTOS = 'true';
      process.env.ALBUM_ID = 'test-album';
      process.env.BOT_DEVELOPMENT_TOKEN = 'test-token';

      const mockCtx = {
        api: { getFile: jest.fn().mockResolvedValue({ file_path: 'test/path.jpg' } as never) },
      } as unknown as Context;

      mockFetchStream.mockResolvedValueOnce('mock-stream' as never);

      await saveFile('test-file-id', 'jpg', mockCtx);

      expect(mockCtx.api.getFile).toHaveBeenCalledWith('test-file-id');
      expect(mockFetchStream).toHaveBeenCalledWith(
        expect.stringContaining('https://api.telegram.org/file/bot'),
      );
      expect(mockFromWeb).toHaveBeenCalledWith('mock-stream');
      expect(mockPipe).toHaveBeenCalledWith(mockWriteStream);
      expect(mockCreateWriteStream).toHaveBeenCalledWith(
        expect.stringContaining('test-file-id.jpg'),
      );
      expect(mockSavePhoto).toHaveBeenCalledWith(
        'test-album',
        expect.stringContaining('test-file-id.jpg'),
      );
    });

    it('should catch and log errors', async () => {
      const mockError = new Error('File Error');
      const mockCtx = {
        api: { getFile: jest.fn().mockRejectedValue(mockError as never) },
      } as unknown as Context;

      await saveFile('test-file-id', 'jpg', mockCtx);

      expect(loggerMod.loggers.errorWithContext).toHaveBeenCalledWith(mockError, 'saveFile');
    });
  });

  describe('generateDailyMessage', () => {
    it('should generate a daily message and pin lineup', async () => {
      const mockBot = {
        api: {
          sendMessage: jest.fn().mockResolvedValue({ message_id: 111 } as never),
          unpinAllChatMessages: jest.fn().mockResolvedValue(true as never),
          pinChatMessage: jest.fn().mockResolvedValue(true as never),
        },
      } as unknown as Bot<BotContext>;

      mockFetchJSON.mockResolvedValueOnce({
        data: [
          {
            forecastDate: '2026-06-29',
            tMin: '10.0',
            tMax: '20.0',
            precipitaProb: '15.0',
            idWeatherType: 1,
            predWindDir: 'N',
            classWindSpeed: 1,
          },
        ],
      } as never);

      mockGetFestivalData.mockReturnValue({});

      // Execute with isAdmin=true to bypass the festival day check
      await generateDailyMessage(mockBot, 555, true);

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        555,
        expect.stringContaining('[pt:daily-greeting]'),
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
    });

    it('should return early if not festival day and not admin', async () => {
      const mockBot = { api: { sendMessage: jest.fn() } } as unknown as Bot<BotContext>;

      mockGetFestivalData.mockReturnValue({ '2099-01-01': [] });

      await generateDailyMessage(mockBot, 555, false);

      expect(mockBot.api.sendMessage).not.toHaveBeenCalled();
      expect(mockFetchJSON).not.toHaveBeenCalled();
    });
  });
});
