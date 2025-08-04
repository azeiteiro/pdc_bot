import { Scenes, Telegraf, session } from 'telegraf';
import type { BotContext } from '../types/types';
import { addExpenseScene } from '../scenes/addExpenseScene.js';
import botCommands from '../botsCommands/generalCommands.js';
import botAdminCommands from '../botsCommands/adminCommands.js';
import logger from '../utils/logger.js';
import { setUserCommands } from '../utils/utils';

const initializeBot = (): Telegraf<BotContext> => {
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

  const bot = new Telegraf<BotContext>(botToken());

  // Create stage and register scene
  const stage = new Scenes.Stage<BotContext>([addExpenseScene]);

  bot.use(session());
  bot.use(stage.middleware());

  // Register bot commands
  botAdminCommands(bot);
  botCommands(bot);

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
};

export const createBot = async () => {
  const telegramBot = initializeBot();

  // Register command handlers (if not already in initializeBot)
  telegramBot.start((ctx) => {
    console.log('👉 inside /start');
    ctx.reply('Welcome!');
  });

  // Register commands
  setUserCommands(telegramBot);

  logger.info(`✅ User commands setted`);

  // Optional scheduled stuff
  // scheduleDailyMessage(telegramBot);
  // subscribeAlerts(telegramBot);

  telegramBot.launch(() => {
    logger.info('🚀 Bot started');
  });
  const me = await telegramBot.telegram.getMe();

  logger.info(`🤖 Running as @${me.username}`);
};
