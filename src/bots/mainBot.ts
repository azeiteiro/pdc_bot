import { Context, Markup, Telegraf } from 'telegraf';
import { config } from 'dotenv';
import utils from '../utils/utils';
import commands from '../utils/botCommands';

const mainBot = (devMode = true) => {
  const { subscribeAlerts } = utils();

  const createBot = (): Telegraf<Context> => {
    config();

    const botToken = (devMode ? process.env.BOT_DEV_TOKEN : process.env.BOT_PROD_TOKEN) as string;

    const bot = new Telegraf(botToken);

    // Register bot commands
    commands(bot);

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
  };

  const telegramBot = createBot();

  const scheduleMessages = () => {
    const userId = parseInt(process.env.DEV_USER_ID || '0', 10);

    subscribeAlerts(telegramBot, userId);
  };

  // Listen for bot commands
  telegramBot.command('lineup', (ctx) =>
    ctx.reply(
      'One time keyboard',
      Markup.keyboard(['/simple', '/inline', '/pyramid']).oneTime().resize(),
    ),
  );

  telegramBot.start((ctx) => ctx.reply('Welcome'));
  telegramBot.help((ctx) => ctx.reply('Send me a sticker'));
  telegramBot.on('sticker', (ctx) => ctx.reply('👍'));
  telegramBot.hears('hi', (ctx) => ctx.reply('Hey there'));
  telegramBot.launch();

  telegramBot.on('text', (ctx) => {
    // Explicit usage
    ctx.telegram.sendMessage(ctx.message.chat.id, `Hello ${ctx.chat.id}`);
    // Using context shortcut
    ctx.reply(`Hello ${ctx.state.role}`);
  });

  return { telegramBot, scheduleMessages };
};

export default mainBot;
