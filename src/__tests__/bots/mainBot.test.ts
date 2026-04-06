import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockBotInstance = {
  use: jest.fn(),
  catch: jest.fn(),
  command: jest.fn(),
  stop: jest.fn(),
  api: {
    getMe: jest.fn().mockResolvedValue({ username: 'testbot' } as never),
    config: {
      use: jest.fn(),
    },
  },
};

jest.unstable_mockModule('@grammyjs/hydrate', () => ({
  hydrate: jest.fn().mockReturnValue('mock-hydrate'),
}));

jest.unstable_mockModule('@grammyjs/auto-retry', () => ({
  autoRetry: jest.fn().mockReturnValue('mock-autoRetry'),
}));

jest.unstable_mockModule('grammy', () => ({
  Bot: jest.fn().mockImplementation(() => mockBotInstance),
  session: jest.fn().mockReturnValue('mock-session'),
}));

jest.unstable_mockModule('@grammyjs/runner', () => ({
  run: jest.fn(),
}));

jest.unstable_mockModule('@grammyjs/conversations', () => ({
  conversations: jest.fn().mockReturnValue('mock-conversations'),
  createConversation: jest.fn().mockReturnValue('mock-createConversation'),
}));

jest.unstable_mockModule('../../scenes/addExpenseScene.js', () => ({
  addExpenseConversation: jest.fn(),
}));

jest.unstable_mockModule('../../botsCommands/generalCommands.js', () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule('../../botsCommands/adminCommands.js', () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.unstable_mockModule('../../utils/utils.js', () => ({
  setUserCommands: jest.fn().mockResolvedValue(undefined as never),
}));

const { Bot, session } = await import('grammy');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { hydrate } = (await import('@grammyjs/hydrate')) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { autoRetry } = (await import('@grammyjs/auto-retry')) as any;
const { run } = await import('@grammyjs/runner');
const botCommands = (await import('../../botsCommands/generalCommands.js')).default;
const botAdminCommands = (await import('../../botsCommands/adminCommands.js')).default;
const utils = await import('../../utils/utils.js');
const logger = (await import('../../utils/logger.js')).default;
const { createBot } = await import('../../bots/mainBot.js');

describe('mainBot', () => {
  const originalEnv = { ...process.env };
  let processOnceSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.BOT_DEVELOPMENT_TOKEN = 'dev-token';
    process.env.BOT_STAGING_TOKEN = 'staging-token';
    process.env.BOT_PRODUCTION_TOKEN = 'prod-token';

    processOnceSpy = jest.spyOn(process, 'once').mockImplementation(() => process);
  });

  afterEach(() => {
    process.env = originalEnv;
    processOnceSpy.mockRestore();
  });

  it('should initialize and run the bot successfully', async () => {
    process.env.NODE_ENV = 'development';

    await createBot();

    // Verify Bot initialization
    expect(Bot).toHaveBeenCalledWith('dev-token');

    // Verify plugins
    expect(hydrate).toHaveBeenCalled();
    expect(autoRetry).toHaveBeenCalled();
    expect(mockBotInstance.use).toHaveBeenCalledWith('mock-hydrate');
    expect(mockBotInstance.api.config.use).toHaveBeenCalledWith('mock-autoRetry');
    expect(session).toHaveBeenCalled();
    expect(mockBotInstance.use).toHaveBeenCalledWith('mock-session');
    expect(mockBotInstance.use).toHaveBeenCalledWith('mock-conversations');
    expect(mockBotInstance.use).toHaveBeenCalledWith('mock-createConversation');

    // Verify commands registered
    expect(botAdminCommands).toHaveBeenCalledWith(mockBotInstance);
    expect(botCommands).toHaveBeenCalledWith(mockBotInstance);

    // Verify utils called
    expect(utils.setUserCommands).toHaveBeenCalledWith(mockBotInstance);

    // Verify runner started
    expect(run).toHaveBeenCalledWith(mockBotInstance);
    expect(logger.info).toHaveBeenCalledWith('🚀 Bot started with grammY runner');
  });

  it('should pick correct tokens for staging and production', async () => {
    // Staging
    process.env.NODE_ENV = 'staging';
    await createBot();
    expect(Bot).toHaveBeenLastCalledWith('staging-token');

    // Production
    process.env.NODE_ENV = 'production';
    await createBot();
    expect(Bot).toHaveBeenLastCalledWith('prod-token');

    // Default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = 'unknown';
    await createBot();
    expect(Bot).toHaveBeenLastCalledWith('dev-token');
  });

  it('should handle session initialization', async () => {
    await createBot();

    // session() was called with { initial: () => any }
    const sessionArgs = (session as jest.Mock).mock.calls[0][0] as {
      initial: () => unknown;
    };

    expect(typeof sessionArgs.initial).toBe('function');

    // Test the initial session state
    const initialState = sessionArgs.initial();

    expect(initialState).toEqual({ expenseData: undefined });
  });

  it('should register a global error handler', async () => {
    await createBot();

    // Verify catch was registered
    expect(mockBotInstance.catch).toHaveBeenCalled();

    // Simulate an error
    const catchCallback = mockBotInstance.catch.mock.calls[0][0] as (err: unknown) => void;
    const mockError = {
      ctx: { update: { update_id: 12345 } },
      error: new Error('Test bot error'),
    };

    catchCallback(mockError);
    expect(logger.error).toHaveBeenCalledWith(
      'Bot error while handling update 12345:',
      mockError.error,
    );
  });

  it('should register the /start command', async () => {
    await createBot();

    expect(mockBotInstance.command).toHaveBeenCalledWith('start', expect.any(Function));

    // Simulate /start command execution
    const startCallback = mockBotInstance.command.mock.calls[0][1] as (ctx: unknown) => void;
    const mockCtx = { reply: jest.fn() };

    startCallback(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledWith('Welcome!');
  });
});
