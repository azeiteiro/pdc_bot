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

const mockConfig = { botToken: 'the-configured-token' };

jest.unstable_mockModule('../../config/environment.js', () => ({
  config: mockConfig,
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

    it('should initialize its own bot using config.botToken if none provided', async () => {
      const { run } = await import('../../jobs/dailyMessage.js');
      const { Bot } = await import('grammy');

      // Raw env tokens are intentionally different from mockConfig.botToken to prove
      // the bot is initialized from config.botToken, not read directly from process.env.
      process.env.BOT_DEVELOPMENT_TOKEN = 'wrong-dev-token';
      process.env.BOT_PRODUCTION_TOKEN = 'wrong-prod-token';
      process.env.GROUP_CHAT_ID = '123456';

      await run();

      expect(Bot).toHaveBeenCalledWith(mockConfig.botToken);
      expect(mockGenerateDailyMessage).toHaveBeenCalled();
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
