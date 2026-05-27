import { Bot, Context, InlineKeyboard } from 'grammy';
import { BotContext } from '../types/types.js';
import { getDays, getInfoMessage, getLineup } from '../utils/utils.js';
import { saveFile } from '../utils/mediaUtils.js';
import logger, { loggers } from '../utils/logger.js';

const botCommands = (bot: Bot<BotContext>) => {
  // Get the lineup for a specific day
  bot.command('lineup', (ctx) => {
    const keyboard = new InlineKeyboard();
    const days = getDays();

    days.forEach((day: string, index: number) => {
      const formattedDay = new Date(day).toLocaleString('en-GB', {
        weekday: 'long',
        day: '2-digit',
      });

      keyboard.text(formattedDay, `lineup-${day}`);
      if ((index + 1) % 3 === 0) keyboard.row();
    });

    ctx.reply('Please select the day', { reply_markup: keyboard });
    logger.info({ userId: ctx.from?.id }, 'User requested lineup');
  });

  // Listen for button clicks on lineup command
  bot.callbackQuery(/^(lineup-)\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/gm, async (ctx) => {
    try {
      if (!ctx.match) return;

      const dayStr = ctx.match[0].replace('lineup-', '');

      await ctx.reply(getLineup(dayStr), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
      await ctx.answerCallbackQuery();
      logger.info({ userId: ctx.from?.id, day: ctx.match[0] }, 'User selected lineup day');
    } catch (e) {
      logger.error(e);
      await ctx.reply('Unknow error, please try again later');
      await ctx.answerCallbackQuery('Error generating lineup').catch(() => {});
    }
  });

  bot.on('message:video_note', (ctx) => {
    const file = ctx.update.message.video_note;
    const fileExtension = 'mp4';
    const fileId = file.file_id;

    saveFile(fileId, fileExtension, ctx as Context);
  });

  bot.on('message:photo', (ctx) => {
    const files = ctx.update.message.photo;

    // Telegram stores multiple images size, last one is the bigger
    const fileId = files[files.length - 1].file_id;

    // Proceed downloading
    saveFile(fileId, 'jpg', ctx as Context);
  });

  bot.on('message:video', (ctx) => {
    const file = ctx.update.message.video;
    const fileExtension = (file.file_name?.match(/\.([^.]*?)(?=\?|#|$)/) || [])[1] || 'mp4';
    const fileId = file.file_id;

    // Proceed downloading
    saveFile(fileId, fileExtension, ctx as Context);
  });

  bot.on('message:animation', (ctx) => {
    const file = ctx.update.message.animation;
    const fileExtension = (file.file_name?.match(/\.([^.]*?)(?=\?|#|$)/) || [])[1] || 'mp4';
    const fileId = file.file_id;

    // Proceed downloading (animations/GIFs)
    saveFile(fileId, fileExtension, ctx as Context);
  });

  bot.on('message:document', (ctx) => {
    const file = ctx.update.message.document;
    const mimeType = file.mime_type || '';

    // Only process image and video documents
    if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
      const fileExtension = (file.file_name?.match(/\.([^.]*?)(?=\?|#|$)/) || [])[1] || 'jpg';
      const fileId = file.file_id;

      saveFile(fileId, fileExtension, ctx as Context);
    }
  });

  bot.command('info', (ctx) => getInfoMessage(ctx));

  bot.command('help', async (ctx) => {
    const adminIds = JSON.parse(process.env.ADMIN_IDS || '[]') as number[];
    const isAdmin = adminIds.includes(ctx.from?.id || 0);

    const scope = isAdmin
      ? { type: 'chat' as const, chat_id: ctx.chat.id }
      : { type: 'all_private_chats' as const };

    const commands = await bot.api.getMyCommands({ scope });

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
      const me = await bot.api.getMe();

      ctx.reply(
        `ℹ️ Please use the /expense command in a private chat with me: https://t.me/${me.username!}`,
      );

      return;
    }

    await ctx.conversation.enter('addExpenseConversation');
  });

  // Log messages
  bot.on('message:text', async (ctx, next) => {
    // Temporary: log chat ID to help find supergroup ID
    if (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group') {
      console.log('📍 Chat ID:', ctx.chat.id, '| Type:', ctx.chat.type, '| Title:', ctx.chat.title);
    }
    loggers.userChat(ctx.from?.id || 0, ctx.message.text.toString());
    await next(); // Allow message to propagate to command handlers
  });
};

export default botCommands;
