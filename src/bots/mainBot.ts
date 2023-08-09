import { Context, Telegraf } from 'telegraf';
import utils from '../utils/utils';
import commands from '../utils/botCommands';
import { Command } from '../types/types';
import jsonCommands from '../resources/commands.json';

const mainBot = () => {
  const { subscribeAlerts, scheduleDailyMessage } = utils();
  const { env } = process;

  const createBot = (): Telegraf<Context> => {
    const botToken = () => {
      switch (env.NODE_ENV) {
        case 'development':
          return env.BOT_DEVELOPMENT_TOKEN;
        case 'staging':
          return env.BOT_STAGING_TOKEN;
        case 'production':
          return env.BOT_PRODUCTION_TOKEN;
        default:
          return env.BOT_DEVELOPMENT_TOKEN;
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

  const scheduleMessages = () => {
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

  return { telegramBot, scheduleMessages };
};

export default mainBot;
