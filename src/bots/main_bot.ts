import { Telegraf } from 'telegraf';
import { config } from 'dotenv';
import utils from '../utils/utils';

const mainBot = (devMode = true) => {
  const { subscribeAlerts } = utils();

  const createBot = () => {
    config();

    const botToken = devMode ? process.env.BOT_DEV_TOKEN : process.env.BOT_PROD_TOKEN;

    const bot = new Telegraf(botToken || '');

    bot.launch();

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

  // bot.command('onetime', (ctx) =>
  //   ctx.reply(
  //     'One time keyboard',
  //     Markup.keyboard(['/simple', '/inline', '/pyramid']).oneTime().resize(),
  //   ),
  // );

  return { bot, scheduleMessages };
};

export default mainBot;
