import { hydrate } from '@grammyjs/hydrate';
import { autoRetry } from '@grammyjs/auto-retry';
import { Bot, session } from 'grammy';
import { run } from '@grammyjs/runner';
import { conversations, createConversation } from '@grammyjs/conversations';
import Database from 'better-sqlite3';
import type { BotContext, SessionData } from '../types/types.js';
import { addExpenseConversation } from '../conversations/addExpenseConversation.js';
import botCommands from '../botsCommands/generalCommands.js';
import botAdminCommands from '../botsCommands/adminCommands.js';
import logger from '../utils/logger.js';
import { setUserCommands } from '../utils/utils.js';
import { i18n } from '../config/i18n.js';
import { createSqliteStorage } from '../storage/sqliteAdapter.js';
import { registerLanguageCommand } from '../botsCommands/languageCommand.js';
import {
  onboardingConversation,
  setOnboardingDatabase,
} from '../conversations/onboardingConversation.js';
import {
  registerOnboardingCommands,
  startOnboardingFlow,
} from '../botsCommands/onboardingCommands.js';
import { initializeUsersTable } from '../storage/userRepository.js';

const initializeBot = (): Bot<BotContext> => {
  const botToken = () => {
    switch (process.env.NODE_ENV) {
      case 'development':
        return process.env.BOT_DEVELOPMENT_TOKEN;
      case 'staging':
        return process.env.BOT_STAGING_TOKEN;
      case 'production':
        return process.env.BOT_PRODUCTION_TOKEN;
      default:
        return process.env.BOT_DEVELOPMENT_TOKEN;
    }
  };

  const bot = new Bot<BotContext>(botToken()!);

  // Enable context hydration
  bot.use(hydrate());

  // Enable automatic retry for failed API calls
  bot.api.config.use(
    autoRetry({
      maxRetryAttempts: 3,
      maxDelaySeconds: 5,
    }),
  );

  // Initialize session storage
  function initial(): SessionData {
    return { expenseData: undefined };
  }

  let storage;

  try {
    const db = new Database('sessions.db');

    // Initialize users table for onboarding
    initializeUsersTable(db);

    // Set database for onboarding conversation
    setOnboardingDatabase(db);

    storage = createSqliteStorage<SessionData>(db);
    logger.info('✅ SQLite session storage initialized');
  } catch (error) {
    logger.error({ error }, '❌ Failed to initialize SQLite, using in-memory sessions');
    storage = undefined; // grammY will use in-memory
  }

  bot.use(session({ initial, storage }));

  // Enable i18n (must come after session when useSession: true, and before conversations)
  bot.use(i18n.middleware());

  // Register language command (includes callback handlers)
  registerLanguageCommand(bot);

  // Install the conversations plugin
  bot.use(conversations());

  // Register conversations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot.use(createConversation(addExpenseConversation as any, 'addExpenseConversation'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot.use(createConversation(onboardingConversation as any, 'onboardingConversation'));

  // Register bot commands
  botAdminCommands(bot, new Database('sessions.db'));
  botCommands(bot);

  // Register onboarding commands
  if (storage) {
    const db = new Database('sessions.db');

    registerOnboardingCommands(bot, db);
  }

  return bot;
};

export const createBot = async () => {
  const telegramBot = initializeBot();

  // Global error handler for the bot
  telegramBot.catch((err) => {
    const ctx = err.ctx;

    logger.error({ err: err.error }, `Bot error while handling update ${ctx.update.update_id}:`);
  });

  telegramBot.command('start', async (ctx) => {
    if (ctx.chat?.type !== 'private') return;

    await ctx.reply(ctx.t('onboarding-start-welcome'));
    await startOnboardingFlow(ctx);
  });

  // Register commands
  await setUserCommands(telegramBot);

  logger.info(`✅ User commands setted`);

  run(telegramBot);
  logger.info('🚀 Bot started with grammY runner');

  const me = await telegramBot.api.getMe();

  logger.info(`🤖 Running as @${me.username}`);

  return telegramBot;
};
