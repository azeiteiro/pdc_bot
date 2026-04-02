import { jest, describe, it, expect, beforeEach, afterAll, beforeAll } from '@jest/globals';

// We must set mock values before importing, but since we want to test failures too,
// we will use dynamic import and module caching reset if possible,
// or simply mock process.exit before dynamic import.
const originalEnv = { ...process.env };

let mockExit: jest.SpiedFunction<typeof process.exit>;
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
let validateEnvironment: Function;

describe('environment', () => {
  beforeAll(async () => {
    mockExit = jest.spyOn(process, 'exit').mockImplementation(((
      code?: string | number | null | undefined,
    ) => {
      throw new Error(`Process exited with code ${code}`);
    }) as never);

    // Provide default valid env so the initial import doesn't throw
    process.env.NODE_ENV = 'development';
    process.env.BOT_DEVELOPMENT_TOKEN = 'test_token';
    process.env.CHAT_ID = 'chat_123';
    process.env.ADMIN_IDS = '[1, 2, 3]';
    process.env.GOOGLE_CLIENT_ID = 'google_id';
    process.env.GOOGLE_CLIENT_SECRET = 'google_secret';
    process.env.GOOGLE_REDIRECT_URL = 'http://localhost';
    process.env.GOOGLE_SPREADSHEET_ID = 'sheet_id';
    process.env.GOOGLE_SHEET_ID = 'sheet_1';
    process.env.ALBUM_ID = 'album_1';
    process.env.ALBUM_URL = 'http://album.url';
    process.env.ACCUWEATHER_API_KEY = 'weather_key';

    const envModule = await import('../../config/environment.js');

    validateEnvironment = envModule.validateEnvironment;
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockExit.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
    mockExit.mockRestore();
  });
  it('should validate and return config when all required variables are present', () => {
    process.env.NODE_ENV = 'development';
    process.env.BOT_DEVELOPMENT_TOKEN = 'test_token';
    process.env.CHAT_ID = 'chat_123';
    process.env.ADMIN_IDS = '[1, 2, 3]';
    process.env.GOOGLE_CLIENT_ID = 'google_id';
    process.env.GOOGLE_CLIENT_SECRET = 'google_secret';
    process.env.GOOGLE_REDIRECT_URL = 'http://localhost';
    process.env.GOOGLE_SPREADSHEET_ID = 'sheet_id';
    process.env.GOOGLE_SHEET_ID = 'sheet_1';
    process.env.ALBUM_ID = 'album_1';
    process.env.ALBUM_URL = 'http://album.url';
    process.env.ACCUWEATHER_API_KEY = 'weather_key';

    const config = validateEnvironment();

    expect(config.nodeEnv).toBe('development');
    expect(config.botToken).toBe('test_token');
    expect(config.adminIds).toEqual([1, 2, 3]);
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should exit when NODE_ENV is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (process.env as any).NODE_ENV;

    expect(() => validateEnvironment()).toThrow('Process exited with code 1');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should exit when required variables are missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.BOT_PRODUCTION_TOKEN = 'test_token';
    process.env.ADMIN_IDS = '[1]';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (process.env as any).CHAT_ID;

    expect(() => validateEnvironment()).toThrow('Process exited with code 1');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should exit when ADMIN_IDS is invalid JSON', () => {
    process.env.NODE_ENV = 'development';
    process.env.BOT_DEVELOPMENT_TOKEN = 'test_token';
    process.env.CHAT_ID = 'chat_123';
    process.env.ADMIN_IDS = 'invalid-json';
    process.env.GOOGLE_CLIENT_ID = 'google_id';
    process.env.GOOGLE_CLIENT_SECRET = 'google_secret';
    process.env.GOOGLE_REDIRECT_URL = 'http://localhost';
    process.env.GOOGLE_SPREADSHEET_ID = 'sheet_id';
    process.env.GOOGLE_SHEET_ID = 'sheet_1';
    process.env.ALBUM_ID = 'album_1';
    process.env.ALBUM_URL = 'http://album.url';
    process.env.ACCUWEATHER_API_KEY = 'weather_key';

    expect(() => validateEnvironment()).toThrow('Process exited with code 1');
  });
});
