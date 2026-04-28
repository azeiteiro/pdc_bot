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
    await ctx.reply(
      'Please provide a description for the expense, e.g., "Lunch at festival"\n\n' +
        'Type /cancel at any time to exit.',
      { reply_markup: { remove_keyboard: true } },
    );

    let msgCtx = await conversation.waitFor('message:text');

    if (msgCtx.message.text.toLowerCase() === '/cancel') {
      await msgCtx.reply('Expense addition cancelled.', {
        reply_markup: { remove_keyboard: true },
      });

      return;
    }
    title = msgCtx.message.text;

    await msgCtx.reply('Please provide the value of the expense, e.g., "10.50"');

    // Loop until a valid amount is provided
    while (true) {
      msgCtx = await conversation.waitFor('message:text');
      if (msgCtx.message.text.toLowerCase() === '/cancel') {
        await msgCtx.reply('Expense addition cancelled.', {
          reply_markup: { remove_keyboard: true },
        });

        return;
      }

      const parsedAmount = Number(msgCtx.message.text);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        await msgCtx.reply('Please provide a valid number for the expense amount.');
      } else {
        amount = parsedAmount;
        break;
      }
    }

    if (name === 'Unknown' || !name) {
      await msgCtx.reply('Unable to retrieve your name. Please provide it manually.');
      msgCtx = await conversation.waitFor('message:text');
      if (msgCtx.message.text.toLowerCase() === '/cancel') {
        await msgCtx.reply('Expense addition cancelled.', {
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
      .text('📝 Edit title')
      .text('👤 Edit name')
      .row()
      .text('💲 Edit value')
      .text('📅 Edit date')
      .row()
      .text('❌ Cancel')
      .text('✅ Accept')
      .oneTime()
      .resized();

    await ctx.reply(
      'I have the following information about you:\n' +
        `Title: ${title || 'Not set'}\n` +
        `Amount: €${amount || 'Not set'}\n` +
        `Name: ${name || 'Not set'}\n` +
        `Date: ${date || 'Not set'}\n\n` +
        'Please confirm the information below by selecting an option from the keyboard:',
      { reply_markup: keyboard },
    );

    const actionCtx = await conversation.waitFor('message:text');
    const action = actionCtx.message.text;

    if (action === '❌ Cancel' || action.toLowerCase() === '/cancel') {
      await actionCtx.reply('Expense addition cancelled.', {
        reply_markup: { remove_keyboard: true },
      });

      return;
    }

    if (action === '✅ Accept') {
      const values = [[title, amount.toString(), name, date, 'Added via Telegram Bot']];

      loggers.sheetsOperation(
        'addExpense',
        true,
        `Title: ${title}, Amount: ${amount}, Name: ${name}, Date: ${date}`,
      );

      try {
        await appendValuesToSheet(values);
        await actionCtx.reply('Expense added successfully!', {
          reply_markup: { remove_keyboard: true },
        });
      } catch (error: unknown) {
        loggers.sheetsOperation(
          'addExpense',
          false,
          `Error adding expense: ${(error as Error).message}`,
        );
        await actionCtx.reply(
          'An error occurred while adding the expense. Please try again later.',
          { reply_markup: { remove_keyboard: true } },
        );
      }

      return;
    }

    // Edit flows
    if (action === '📝 Edit title') {
      await actionCtx.reply('Please provide a new title for the expense:', {
        reply_markup: { remove_keyboard: true },
      });
      const editCtx = await conversation.waitFor('message:text');

      title = editCtx.message.text;
    } else if (action === '💲 Edit value') {
      await actionCtx.reply('Please provide a new value for the expense, e.g., "10.50":', {
        reply_markup: { remove_keyboard: true },
      });
      while (true) {
        const editCtx = await conversation.waitFor('message:text');
        const parsedAmount = Number(editCtx.message.text);

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          await editCtx.reply('Please provide a valid number for the expense amount.');
        } else {
          amount = parsedAmount;
          break;
        }
      }
    } else if (action === '👤 Edit name') {
      await actionCtx.reply("Please provide the payer's name:", {
        reply_markup: { remove_keyboard: true },
      });
      const editCtx = await conversation.waitFor('message:text');

      name = editCtx.message.text;
    } else if (action === '📅 Edit date') {
      await actionCtx.reply(
        'Please provide the date (YYYY-MM-DD) or type "today" for current date:',
        { reply_markup: { remove_keyboard: true } },
      );
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
          await editCtx.reply('Please provide a valid date in YYYY-MM-DD format or type "today":');
        }
      }
    }
  }
};
