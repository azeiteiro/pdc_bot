import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Define mocks
jest.unstable_mockModule('grammy', () => ({
  Bot: jest.fn().mockImplementation(() => ({})),
}));

const mockGenerateDailyMessage = jest.fn();

jest.unstable_mockModule('../../utils/utils.js', () => ({
  generateDailyMessage: mockGenerateDailyMessage,
}));

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: mockLogger,
}));

describe('Daily Message Job', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should export job configuration', async () => {
    const jobModule = await import('../../jobs/dailyMessage.js');

    expect(jobModule).toHaveProperty('name');
    expect(jobModule).toHaveProperty('cron');
    expect(jobModule).toHaveProperty('run');
  });

  it('should have correct cron schedule', async () => {
    const { cron } = await import('../../jobs/dailyMessage.js');

    expect(cron).toBe('0 9 * * *');
  });

  it('should have valid job name', async () => {
    const { name } = await import('../../jobs/dailyMessage.js');

    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  describe('run()', () => {
    it('should call generateDailyMessage when bot and chatId are provided', async () => {
      const { run } = await import('../../jobs/dailyMessage.js');
      const mockBot = {} as unknown as import('grammy').Bot<
        import('../../types/types.js').BotContext
      >;

      process.env.GROUP_CHAT_ID = '123456';

      await run(mockBot);

      expect(mockGenerateDailyMessage).toHaveBeenCalledWith(mockBot, 123456);
      expect(mockLogger.info).toHaveBeenCalledWith('Daily message sent successfully');
    });

    it('should initialize its own bot if none provided', async () => {
      const { run } = await import('../../jobs/dailyMessage.js');
      const { Bot } = await import('grammy');

      process.env.NODE_ENV = 'development';
      process.env.BOT_DEVELOPMENT_TOKEN = 'test-token';
      process.env.GROUP_CHAT_ID = '123456';

      await run();

      expect(Bot).toHaveBeenCalledWith('test-token');
      expect(mockGenerateDailyMessage).toHaveBeenCalled();
    });

    it('should use production token in production environment', async () => {
      const { run } = await import('../../jobs/dailyMessage.js');
      const { Bot } = await import('grammy');

      process.env.NODE_ENV = 'production';
      process.env.BOT_PRODUCTION_TOKEN = 'prod-token';
      process.env.GROUP_CHAT_ID = '123456';

      await run();

      expect(Bot).toHaveBeenCalledWith('prod-token');
    });

    it('should error if no token is found in environment', async () => {
      const { run } = await import('../../jobs/dailyMessage.js');

      process.env.NODE_ENV = 'development';
      delete process.env.BOT_DEVELOPMENT_TOKEN;

      await expect(run()).rejects.toThrow('Bot token not found in environment');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log error if GROUP_CHAT_ID is missing', async () => {
      const { run } = await import('../../jobs/dailyMessage.js');
      const mockBot = {} as unknown as import('grammy').Bot<
        import('../../types/types.js').BotContext
      >;

      delete process.env.GROUP_CHAT_ID;

      await run(mockBot);

      expect(mockLogger.error).toHaveBeenCalledWith('GROUP_CHAT_ID environment variable not set');
      expect(mockGenerateDailyMessage).not.toHaveBeenCalled();
    });

    it('should throw and log if generateDailyMessage fails', async () => {
      const { run } = await import('../../jobs/dailyMessage.js');
      const mockBot = {} as unknown as import('grammy').Bot<
        import('../../types/types.js').BotContext
      >;

      process.env.GROUP_CHAT_ID = '123456';
      const error = new Error('API Error');

      mockGenerateDailyMessage.mockRejectedValue(error);

      await expect(run(mockBot)).rejects.toThrow('API Error');
      expect(mockLogger.error).toHaveBeenCalledWith({ err: error }, 'Failed to send daily message');
    });
  });
});
