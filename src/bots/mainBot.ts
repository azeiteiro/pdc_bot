import { Context, Telegraf } from 'telegraf';
import { subscribeAlerts } from '../utils/utils.ts';
import commands from '../utils/botCommands.ts';
import type { Command } from '../types/types';
import jsonCommands from '../resources/commands.json' with { type: 'json' };

const createBot = (): Telegraf<Context> => {
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

  const bot = new Telegraf(botToken());

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
