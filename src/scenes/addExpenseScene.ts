import { Keyboard } from 'grammy';
import type { BotContext, BotConversation } from '../types/types.js';
import { appendValuesToSheet } from '../googleApi/googleSheetsApi.js';
import { loggers } from '../utils/logger.js';

const getUserName = (ctx: BotContext): string => {
  if (ctx.from) {
    return `${ctx.from.first_name ?? ''} ${ctx.from.last_name ?? ''}`.trim();
  }

  return 'Unknown';
};

const formatDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
};

export const addExpenseConversation = async (conversation: BotConversation, ctx: BotContext) => {
  // Get everything after '/expense '
  const fullText = ctx.message?.text || '';
  const commandIndex = fullText.indexOf('/expense');
  const argsText = fullText.slice(commandIndex + 8).trim();

  let title: string;
  let amount: number;
  let name = getUserName(ctx);
  let date = formatDate(new Date());

  // If arguments provided, try quick insert
  if (argsText) {
    const args = argsText.split(' ');

    if (args.length < 2) {
      await ctx.reply(ctx.t('expense-usage'));

      return;
    }

    const valueStr = args[args.length - 1];

    title = args.slice(0, -1).join(' ');
    amount = Number(valueStr);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(ctx.t('expense-invalid-amount'));

      return;
    }
  } else {
    // Interactive flow
    await ctx.reply(ctx.t('expense-enter-description'), {
      reply_markup: { remove_keyboard: true },
    });

    let msgCtx = await conversation.waitFor('message:text');

    if (msgCtx.message.text.toLowerCase() === '/cancel') {
      await msgCtx.reply(ctx.t('expense-cancelled'), {
        reply_markup: { remove_keyboard: true },
      });

      return;
    }
    title = msgCtx.message.text;

    await msgCtx.reply(ctx.t('expense-enter-amount'));

    // Loop until a valid amount is provided
    while (true) {
      msgCtx = await conversation.waitFor('message:text');
      if (msgCtx.message.text.toLowerCase() === '/cancel') {
        await msgCtx.reply(ctx.t('expense-cancelled'), {
          reply_markup: { remove_keyboard: true },
        });

        return;
      }

      const parsedAmount = Number(msgCtx.message.text);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        await msgCtx.reply(ctx.t('expense-invalid-amount'));
      } else {
        amount = parsedAmount;
        break;
      }
    }

    if (name === 'Unknown' || !name) {
      await msgCtx.reply(ctx.t('expense-enter-name'));
      msgCtx = await conversation.waitFor('message:text');
      if (msgCtx.message.text.toLowerCase() === '/cancel') {
        await msgCtx.reply(ctx.t('expense-cancelled'), {
          reply_markup: { remove_keyboard: true },
        });

        return;
      }
      name = msgCtx.message.text;
    }
  }

  // Confirmation Loop
  while (true) {
    const keyboard = new Keyboard()
      .text(ctx.t('expense-edit-title'))
      .text(ctx.t('expense-edit-name'))
      .row()
      .text(ctx.t('expense-edit-value'))
      .text(ctx.t('expense-edit-date'))
      .row()
      .text(ctx.t('expense-cancel'))
      .text(ctx.t('expense-accept'))
      .oneTime()
      .resized();

    await ctx.reply(
      ctx.t('expense-confirmation', {
        title: title || ctx.t('expense-not-set'),
        amount: amount || ctx.t('expense-not-set'),
        name: name || ctx.t('expense-not-set'),
        date: date || ctx.t('expense-not-set'),
      }),
      { reply_markup: keyboard },
    );

    const actionCtx = await conversation.waitFor('message:text');
    const action = actionCtx.message.text;

    if (action === ctx.t('expense-cancel') || action.toLowerCase() === '/cancel') {
      await actionCtx.reply(ctx.t('expense-cancelled'), {
        reply_markup: { remove_keyboard: true },
      });

      return;
    }

    if (action === ctx.t('expense-accept')) {
      const values = [[title, amount.toString(), name, date, 'Added via Telegram Bot']];

      loggers.sheetsOperation(
        'addExpense',
        true,
        `Title: ${title}, Amount: ${amount}, Name: ${name}, Date: ${date}`,
      );

      try {
        await appendValuesToSheet(values);
        await actionCtx.reply(ctx.t('expense-success'), {
          reply_markup: { remove_keyboard: true },
        });
      } catch (error: unknown) {
        loggers.sheetsOperation(
          'addExpense',
          false,
          `Error adding expense: ${(error as Error).message}`,
        );
        await actionCtx.reply(ctx.t('expense-sheets-error'), {
          reply_markup: { remove_keyboard: true },
        });
      }

      return;
    }

    // Edit flows
    if (action === ctx.t('expense-edit-title')) {
      await actionCtx.reply(ctx.t('expense-edit-title-prompt'), {
        reply_markup: { remove_keyboard: true },
      });
      const editCtx = await conversation.waitFor('message:text');

      title = editCtx.message.text;
    } else if (action === ctx.t('expense-edit-value')) {
      await actionCtx.reply(ctx.t('expense-edit-value-prompt'), {
        reply_markup: { remove_keyboard: true },
      });
      while (true) {
        const editCtx = await conversation.waitFor('message:text');
        const parsedAmount = Number(editCtx.message.text);

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          await editCtx.reply(ctx.t('expense-invalid-amount'));
        } else {
          amount = parsedAmount;
          break;
        }
      }
    } else if (action === ctx.t('expense-edit-name')) {
      await actionCtx.reply(ctx.t('expense-edit-name-prompt'), {
        reply_markup: { remove_keyboard: true },
      });
      const editCtx = await conversation.waitFor('message:text');

      name = editCtx.message.text;
    } else if (action === ctx.t('expense-edit-date')) {
      await actionCtx.reply(ctx.t('expense-enter-date'), {
        reply_markup: { remove_keyboard: true },
      });
      while (true) {
        const editCtx = await conversation.waitFor('message:text');
        const text = editCtx.message.text;

        if (text.toLowerCase() === 'today') {
          date = new Date().toISOString().split('T')[0];
          break;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          date = text;
          break;
        } else {
          await editCtx.reply(ctx.t('expense-invalid-date'));
        }
      }
    }
  }
};
