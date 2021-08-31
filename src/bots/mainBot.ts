import { Telegraf } from 'telegraf';
import { config } from 'dotenv';
import utils from '../utils/utils';
import commands from '../utils/botCommands';

const mainBot = (devMode = true) => {
  const { subscribeAlerts } = utils();

  const createBot = () => {
    config();

    const botToken = devMode ? process.env.BOT_DEV_TOKEN : process.env.BOT_PROD_TOKEN;

    const bot = new Telegraf(botToken || '');

    bot.launch();

    // Register bot commands
    commands(bot);

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
  };

  const bot = createBot();

  const scheduleMessages = () => {
    const userId = parseInt(process.env.DEV_USER_ID || '0', 10);

    subscribeAlerts(bot, userId);
  };

  // Listen for bot commands
  // bot.command('lineup', (ctx) =>
  //   ctx.reply(
  //     'One time keyboard',
  //     Markup.keyboard(['/simple', '/inline', '/pyramid']).oneTime().resize(),
  //   ),
  // );

  // bot.start((ctx) => ctx.reply('Welcome'));
  // bot.help((ctx) => ctx.reply('Send me a sticker'));
  // bot.on('sticker', (ctx) => ctx.reply('👍'));
  // bot.hears('hi', (ctx) => ctx.reply('Hey there'));
  // bot.launch();

  // bot.on('text', (ctx) => {
  //   // Explicit usage
  //   ctx.telegram.sendMessage(ctx.message.chat.id, `Hello ${ctx.chat.id}`);
  //   // Using context shortcut
  //   ctx.reply(`Hello ${ctx.state.role}`);
  // });

  return { bot, scheduleMessages };
};

export default mainBot;
