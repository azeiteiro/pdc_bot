import { hydrate } from '@grammyjs/hydrate';
import { autoRetry } from '@grammyjs/auto-retry';
import { Bot, session } from 'grammy';
import { run } from '@grammyjs/runner';
import { conversations, createConversation } from '@grammyjs/conversations';
import type { BotContext, SessionData } from '../types/types.js';
import { addExpenseConversation } from '../scenes/addExpenseScene.js';
import botCommands from '../botsCommands/generalCommands.js';
import botAdminCommands from '../botsCommands/adminCommands.js';
import logger from '../utils/logger.js';
import { setUserCommands } from '../utils/utils.js';

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

  // Initialize session memory
  function initial(): SessionData {
    return { expenseData: undefined };
  }

  bot.use(session({ initial }));

  // Install the conversations plugin
  bot.use(conversations());

  // Register conversations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot.use(createConversation(addExpenseConversation as any, 'addExpenseConversation'));

  // Register bot commands
  botAdminCommands(bot);
  botCommands(bot);

  return bot;
};

export const createBot = async () => {
  const telegramBot = initializeBot();

  // Global error handler for the bot
  telegramBot.catch((err) => {
    const ctx = err.ctx;

    logger.error(`Bot error while handling update ${ctx.update.update_id}:`, err.error);
  });

  telegramBot.command('start', (ctx) => {
    console.log('👉 inside /start');
    ctx.reply('Welcome!');
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
