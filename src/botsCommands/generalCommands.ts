import { Bot, Context, InlineKeyboard } from 'grammy';
import { BotContext } from '../types/types.js';
import { getDays, getInfoMessage, getLineup } from '../utils/utils.js';
import { saveFile } from '../utils/mediaUtils.js';
import logger, { loggers } from '../utils/logger.js';
import { getUserLocale } from '../config/i18n.js';

const botCommands = (bot: Bot<BotContext>) => {
  // Get the lineup for a specific day
  bot.command('lineup', async (ctx) => {
    const keyboard = new InlineKeyboard();
    const days = getDays();

    days.forEach((day: string, index: number) => {
      const formattedDay = new Date(day).toLocaleString('pt-PT', {
        weekday: 'long',
        day: '2-digit',
      });

      keyboard.text(formattedDay, `lineup-${day}`);
      if ((index + 1) % 3 === 0) keyboard.row();
    });

    logger.info({ userId: ctx.from?.id }, 'User requested lineup');

    if (ctx.chat?.type !== 'private') {
      await bot.api.sendMessage(ctx.from!.id, ctx.t('general-lineup-select-day'), {
        reply_markup: keyboard,
      });

      return;
    }

    ctx.reply(ctx.t('general-lineup-select-day'), { reply_markup: keyboard });
  });

  // Listen for button clicks on lineup command
  bot.callbackQuery(/^(lineup-)\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/gm, async (ctx) => {
    try {
      if (!ctx.match) return;

      const dayStr = ctx.match[0].replace('lineup-', '');

      await ctx.reply(getLineup(dayStr, getUserLocale(ctx) as 'en' | 'pt'), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
      await ctx.answerCallbackQuery();
      logger.info({ userId: ctx.from?.id, day: ctx.match[0] }, 'User selected lineup day');
    } catch (e) {
      logger.error(e);
      await ctx.reply(ctx.t('general-unknown-error'));
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

  bot.command('info', async (ctx) => {
    if (ctx.chat?.type !== 'private') {
      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${process.env.ONBOARDING_SPREADSHEET_ID}/edit?usp=sharing`;

      await bot.api.sendMessage(
        ctx.from!.id,
        ctx.t('info-useful-links', {
          albumUrl: process.env.ALBUM_URL ?? '',
          spreadsheetUrl,
        }),
        {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        },
      );

      return;
    }

    getInfoMessage(ctx);
  });

  bot.command('help', async (ctx) => {
    const adminIds = JSON.parse(process.env.ADMIN_IDS || '[]') as number[];
    const isAdmin = adminIds.includes(ctx.from?.id || 0);

    // Always use the user's private chat ID for scope so group callers get their correct command list
    const scope = isAdmin
      ? { type: 'chat' as const, chat_id: ctx.from!.id }
      : { type: 'all_private_chats' as const };

    const commands = await bot.api.getMyCommands({ scope, language_code: getUserLocale(ctx) });
    const info = commands.reduce((acc, val) => `${acc}/${val.command} - ${val.description}\n`, '');

    if (ctx.chat?.type !== 'private') {
      await bot.api.sendMessage(ctx.from!.id, info.trim());

      return;
    }

    ctx.reply(info.trim());
  });

  bot.command('about', async (ctx) => {
    if (ctx.chat?.type !== 'private') {
      await bot.api.sendMessage(ctx.from!.id, ctx.t('general-about'));

      return;
    }

    ctx.reply(ctx.t('general-about'));
  });

  bot.command('expense', async (ctx) => {
    // Check if Sheet ID is set
    if (!process.env.ONBOARDING_SPREADSHEET_ID) {
      ctx.reply(ctx.t('expense-no-spreadsheet'));

      return;
    }
    const chatType = ctx.chat?.type;

    if (chatType !== 'private') {
      const me = await bot.api.getMe();

      await bot.api.sendMessage(
        ctx.from!.id,
        ctx.t('general-expense-private-only', { username: me.username! }),
      );

      return;
    }

    await ctx.conversation.enter('addExpenseConversation');
  });

  // Log messages
  bot.on('message:text', async (ctx, next) => {
    loggers.userChat(ctx.from?.id || 0, ctx.message.text.toString());
    await next(); // Allow message to propagate to command handlers
  });
};

export default botCommands;
