import { Scenes, Telegraf, session } from 'telegraf';
import { subscribeAlerts } from '../utils/utils.js';
import commands from '../utils/botCommands.js';
import type { BotContext, Command } from '../types/types';
import jsonCommands from '../resources/commands.json' with { type: 'json' };
import { addExpenseScene } from '../utils/scenes.js';

const createBot = (): Telegraf<BotContext> => {
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
  commands(bot);

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
};

const telegramBot = createBot();

export const scheduleMessages = () => {
  subscribeAlerts(telegramBot);

  // scheduleDailyMessage(telegramBot);
};

telegramBot.start((ctx) => ctx.reply('Welcome'));

telegramBot.settings(async (ctx) => {
  const botCommands = jsonCommands as Array<Command>;

  await telegramBot.telegram.setMyCommands(botCommands);

  return ctx.reply('Ok');
});

telegramBot.help(async (ctx) => {
  const commandsInfo = await telegramBot.telegram.getMyCommands();
  const info = commandsInfo.reduce(
    (acc, val) => `${acc}/${val.command} - ${val.description}\n`,
    '',
  );

  return ctx.reply(info);
});

telegramBot.action('delete', (ctx) => ctx.deleteMessage());
telegramBot.on('dice', (ctx) => ctx.reply(`Value: ${ctx.message.dice.value}`));
telegramBot.launch();
