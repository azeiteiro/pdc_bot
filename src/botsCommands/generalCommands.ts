import { Markup, Telegraf, Context } from 'telegraf';
import { BotContext } from '../types/types.js';
import { handleExpenseCommand } from '../scenes/addExpenseScene.js';
import { getDays, getInfoMessage, getLineup, saveFile } from '../utils/utils.js';
import logger, { loggers } from '../utils/logger.js';
import {
  BotCommandScopeAllPrivateChats,
  BotCommandScopeChat,
} from 'telegraf/typings/core/types/typegram.js';

const botCommands = (bot: Telegraf<BotContext>) => {
  // Get the lineup for a specific day
  bot.command('lineup', (ctx) => {
    ctx.reply(
      'Please select the day',
      Markup.inlineKeyboard(
        getDays().map((day: string) =>
          Markup.button.callback(
            `${new Date(day).toLocaleString('en-GB', { weekday: 'long', day: '2-digit' })}`,
            `lineup-${day}`,
          ),
        ),
        {
          wrap: (btn, index) => index % 3 === 0,
        },
      ),
    );
    logger.info('User requested lineup', { userId: ctx.from.id });
  });

  // Listen for button clicks on lineup command
  bot.action(/^(lineup-)\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/gm, (ctx) => {
    try {
      ctx.replyWithHTML(getLineup(ctx.match[0].replace('lineup-', '')), {
        link_preview_options: { is_disabled: true },
      });
      logger.info('User selected lineup day', { userId: ctx.from?.id, day: ctx.match[0] });
    } catch (e) {
      logger.error(e);
      ctx.reply('Unknow error, please try again later');
    }
  });

  bot.on('video_note', (ctx) => {
    const file = ctx.update.message.video_note;
    const fileExtension = 'mp4';
    const fileId = file.file_id;

    saveFile(fileId, fileExtension, ctx as Context);
  });

  bot.on('photo', (ctx) => {
    const files = ctx.update.message.photo;

    // Telegram stores multiple images size, last one is the bigger
    const fileId = files[files.length - 1].file_id;

    // Proceed downloading
    saveFile(fileId, 'jpg', ctx as Context);
  });

  bot.on('video', (ctx) => {
    const file = ctx.update.message.video;
    const fileExtension = (file.file_name?.match(/\.([^.]*?)(?=\?|#|$)/) || [])[1];
    const fileId = file.file_id;

    // Proceed downloading
    saveFile(fileId, fileExtension, ctx as Context);
  });

  bot.command('info', (ctx) => getInfoMessage(ctx));

  bot.command('help', async (ctx) => {
    const adminIds = JSON.parse(process.env.ADMIN_IDS || '[]') as number[];
    const isAdmin = adminIds.includes(ctx.from?.id || 0);

    const scope = isAdmin
      ? ({ type: 'chat', chat_id: ctx.chat.id } as BotCommandScopeChat)
      : ({ type: 'all_private_chats' } as BotCommandScopeAllPrivateChats);

    const commands = await bot.telegram.getMyCommands({ scope });

    const info = commands.reduce((acc, val) => `${acc}/${val.command} - ${val.description}\n`, '');

    ctx.reply(info.trim());
  });

  bot.command('about', (ctx) => {
    ctx.reply(
      'This bot allows you to see the schedule for the PDC 2025 festival. Use /help to see more.',
    );
  });

  bot.command('expense', async (ctx) => {
    // Check if Sheet ID is set
    if (!process.env.GOOGLE_SPREADSHEET_ID) {
      ctx.reply('Google Spreadsheet ID is not set. Please contact the administrator.');

      return;
    }
    const chatType = ctx.chat?.type;

    if (chatType !== 'private') {
      const me = await bot.telegram.getMe();

      ctx.reply(
        `ℹ️ Please use the /expense command in a private chat with me: https://t.me/${me.username!}`,
      );

      return;
    }

    handleExpenseCommand(ctx);
  });

  // Log messages
  bot.on('message', (ctx) => {
    console.log('userChat', ctx.message);
    loggers.userChat(ctx.from.id, ctx.message.toString());
  });
};

export default botCommands;
