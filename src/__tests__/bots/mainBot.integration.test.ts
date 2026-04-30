import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockBotInstance = {
  use: jest.fn(),
  catch: jest.fn(),
  command: jest.fn(),
  callbackQuery: jest.fn(),
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
  InlineKeyboard: jest.fn().mockImplementation(() => ({
    text: jest.fn().mockReturnThis(),
    row: jest.fn().mockReturnThis(),
  })),
}));

jest.unstable_mockModule('@grammyjs/runner', () => ({
  run: jest.fn(),
}));

jest.unstable_mockModule('@grammyjs/conversations', () => ({
  conversations: jest.fn().mockReturnValue('mock-conversations'),
  createConversation: jest.fn().mockReturnValue('mock-createConversation'),
}));

jest.unstable_mockModule('better-sqlite3', () => ({
  default: jest.fn().mockImplementation(() => ({
    exec: jest.fn(),
    prepare: jest.fn().mockReturnValue({
      get: jest.fn(),
      run: jest.fn(),
    }),
  })),
}));

jest.unstable_mockModule('../../storage/sqliteAdapter.js', () => ({
  createSqliteStorage: jest.fn().mockReturnValue({
    read: jest.fn(),
    write: jest.fn(),
    delete: jest.fn(),
  }),
}));

jest.unstable_mockModule('../../botsCommands/languageCommand.js', () => ({
  registerLanguageCommand: jest.fn(),
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

jest.unstable_mockModule('../../conversations/onboardingConversation.js', () => ({
  onboardingConversation: jest.fn(),
}));

jest.unstable_mockModule('../../botsCommands/onboardingCommands.js', () => ({
  registerOnboardingCommands: jest.fn(),
  handleOnboardingComplete: jest.fn(),
}));

jest.unstable_mockModule('../../storage/userRepository.js', () => ({
  initializeUsersTable: jest.fn(),
  getUserById: jest.fn(),
  createOrUpdateUser: jest.fn(),
  deleteUser: jest.fn(),
  updateUserStatus: jest.fn(),
  getPendingUsers: jest.fn(),
}));

const { createBot } = await import('../../bots/mainBot.js');
const { registerLanguageCommand } = await import('../../botsCommands/languageCommand.js');

describe('Main Bot Integration', () => {
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

  it('should initialize with SQLite storage and register language command', async () => {
    process.env.NODE_ENV = 'development';

    await createBot();

    // Verify registerLanguageCommand was called
    expect(registerLanguageCommand).toHaveBeenCalledWith(mockBotInstance);

    // Verify Bot is properly initialized
    expect(mockBotInstance.use).toHaveBeenCalled();
  });
});
