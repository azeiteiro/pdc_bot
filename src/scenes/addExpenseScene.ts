import { Context, Markup, Scenes } from 'telegraf';
import { BotContext } from '../types/types';
import { appendValuesToSheet } from '../utils/sheetsApi.js';
import { Message, Update } from 'telegraf/typings/core/types/typegram';
import { CommandContextExtn } from 'telegraf/typings/telegram-types';

// Create the scene
export const addExpenseScene = new Scenes.BaseScene<BotContext>('addExpense');

const getUserName = (ctx: BotContext): string => {
  if (ctx.from) {
    return `${ctx.from.first_name ?? ''} ${ctx.from.last_name ?? ''}`;
  }

  return 'Unknown';
};

export const handleExpenseCommand = (
  ctx: Context<{
    message: Update.New & Update.NonChannel & Message.TextMessage;
    update_id: number;
  }> &
    Omit<BotContext, keyof Context<Update>> &
    CommandContextExtn,
) => {
  // Get everything after '/expense '
  const fullText = ctx?.message?.text;
  const commandIndex = fullText.indexOf('/expense');
  const argsText = fullText.slice(commandIndex + 8).trim(); // Remove '/expense' and trim

  // If no arguments provided, start interactive flow
  if (!argsText) {
    ctx.scene.enter('addExpense');

    return;
  }

  // Arguments provided - try quick insert
  const args = argsText.split(' ');

  if (args.length < 2) {
    ctx.reply(
      'Usage: /expense <title> <value>\nExample: /expense Lunch at festival 10.50\nOr just /expense for interactive mode',
    );

    return;
  }

  // Last part is the value, everything else is the title
  const value = args[args.length - 1];
  const title = args.slice(0, -1).join(' '); // Join all parts except the last one

  // Validate the value
  const amount = Number(value);

  if (isNaN(amount) || amount <= 0) {
    ctx.reply('Please provide a valid number for the expense amount.');

    return;
  }

  // Pre-fill session data and enter scene
  ctx.session = ctx.session || {};
  ctx.session.expenseData = {
    title: title,
    name: '',
    amount: amount,
    date: new Date().toISOString().split('T')[0],
    step: 'complete', // Skip to confirmation
  };

  // Get name automatically
  const name = getUserName(ctx);

  if (name !== 'Unknown') {
    ctx.session.expenseData.name = name;
  }

  ctx.scene.enter('addExpense');
};

// Show confirmation keyboard
const showConfirmationKeyboard = (ctx: BotContext) => {
  const expenseData = ctx.session.expenseData;

  ctx.reply(
    'I have the following information about you:\n' +
      `Title: ${expenseData?.title ?? 'Not set'}\n` +
      `Amount: €${expenseData?.amount ?? 'Not set'}\n` +
      `Name: ${expenseData?.name ?? 'Not set'}\n` +
      `Date: ${expenseData?.date ?? 'Not set'}\n\n` +
      'Please confirm the information below by selecting an option from the keyboard:',
    Markup.keyboard([
      ['📝 Edit title', '👤 Edit name'],
      ['💲 Edit value', '📅 Edit date'],
      ['❌ Cancel', '✅ Accept'],
    ])
      .oneTime()
      .resize(),
  );
};

addExpenseScene.enter((ctx) => {
  ctx.session = ctx.session || {};

  // Check if data is already provided via quick insert
  if (ctx.session.expenseData && ctx.session.expenseData.step === 'complete') {
    // Data pre-filled from quick insert, go straight to confirmation
    if (!ctx.session.expenseData.name) {
      // Name not set, ask for it
      ctx.session.expenseData.step = 'name';
      ctx.reply('Unable to retrieve your name. Please provide it manually.');
    } else {
      // All data available, show confirmation
      showConfirmationKeyboard(ctx);
    }
  } else {
    // Interactive flow - start from beginning
    ctx.session.expenseData = {
      title: '',
      name: '',
      amount: 0,
      date: '',
      step: 'title',
    };

    ctx.reply(
      'Please provide a description for the expense, e.g., "Lunch at festival"\n\n' +
        'Type /cancel at any time to exit.',
      Markup.removeKeyboard(),
    );
  }
});

const completeExpense = (ctx: BotContext) => {
  const expenseData = ctx.session.expenseData;

  if (!expenseData) {
    ctx.reply('No expense data found. Please start the process again.');

    return;
  }

  const values = [
    [
      expenseData.title,
      expenseData.amount.toString(),
      expenseData.name,
      expenseData.date,
      'Added via Telegram Bot',
    ],
  ];

  appendValuesToSheet(values)
    .then(() => {
      ctx.reply('Expense added successfully!', Markup.removeKeyboard());
      ctx.scene.leave();
    })
    .catch((error) => {
      console.error('Error adding expense:', error);
      ctx.reply('An error occurred while adding the expense. Please try again later.');
    });
};

// Callback from the confirmation keyboard
addExpenseScene.hears(
  /📝 Edit title|👤 Edit name|💲 Edit value|📅 Edit date|✅ Accept|❌ Cancel/,
  async (ctx) => {
    const action = ctx.message.text;

    if (!ctx.session.expenseData) {
      return;
    }

    switch (action) {
      case '📝 Edit title':
        ctx.session.expenseData.step = 'title';
        ctx.reply('Please provide a new title for the expense:', Markup.removeKeyboard());
        break;

      case '💲 Edit value':
        ctx.session.expenseData.step = 'amount';
        ctx.reply(
          'Please provide a new value for the expense, e.g., "10.50":',
          Markup.removeKeyboard(),
        );
        break;

      case '👤 Edit name':
        ctx.session.expenseData.step = 'name';
        ctx.reply("Please provide the payer's name:", Markup.removeKeyboard());
        break;

      case '📅 Edit date':
        ctx.session.expenseData.step = 'date';
        ctx.reply(
          'Please provide the date (YYYY-MM-DD) or type "today" for current date:',
          Markup.removeKeyboard(),
        );
        break;

      case '✅ Accept':
        // Process the expense (save to Google Sheets, etc.)
        completeExpense(ctx);
        break;

      case '❌ Cancel':
        ctx.reply('Expense addition cancelled.', Markup.removeKeyboard());
        ctx.scene.leave();
        break;
    }
  },
);

addExpenseScene.leave((ctx) => {
  // Clean up any remaining session data
  if (ctx.session?.expenseData) {
    delete ctx.session.expenseData;
  }
});

// Handle text input based on the current step
addExpenseScene.on('text', async (ctx) => {
  // Check for exit command
  if (ctx.message.text.toLowerCase() === '/cancel') {
    if (ctx.session?.expenseData) {
      delete ctx.session.expenseData;
    }
    ctx.reply('Expense addition cancelled.', Markup.removeKeyboard());
    ctx.scene.leave();

    return;
  }
  // Ensure session exists
  ctx.session = ctx.session || {};

  // Don't reinitialize! Just check if expenseData exists
  if (!ctx.session.expenseData) {
    ctx.session.expenseData = {
      title: '',
      name: '',
      amount: 0,
      date: '',
      step: 'title',
    };
  }

  const step = ctx.session.expenseData.step;

  if (step === 'title') {
    ctx.session.expenseData.title = ctx.message.text;

    // Check if this is initial flow or editing
    if (ctx.session.expenseData.amount === 0) {
      // Initial flow - continue to amount step
      ctx.session.expenseData.step = 'amount';
      ctx.reply('Please provide the value of the expense, e.g., "10.50"');
    } else {
      // Editing - go back to confirmation
      ctx.session.expenseData.step = 'complete';
      showConfirmationKeyboard(ctx);
    }
  } else if (step === 'amount') {
    const amount = Number(ctx.message.text);

    if (isNaN(amount) || amount <= 0) {
      ctx.reply('Please provide a valid number for the expense amount.');

      return;
    }

    ctx.session.expenseData.amount = amount;

    // Check if this is initial flow or editing
    if (!ctx.session.expenseData.name) {
      // Initial flow - continue to name step
      ctx.session.expenseData.step = 'name';
      const name = getUserName(ctx);

      if (name === 'Unknown') {
        ctx.reply('Unable to retrieve your name. Please provide it manually.');
      } else {
        ctx.session.expenseData.name = name;
        const currentDate = new Date().toISOString().split('T')[0];

        ctx.session.expenseData.date = currentDate;
        ctx.session.expenseData.step = 'complete';
        showConfirmationKeyboard(ctx);
      }
    } else {
      // Editing - go back to confirmation
      ctx.session.expenseData.step = 'complete';
      showConfirmationKeyboard(ctx);
    }
  } else if (step === 'name') {
    ctx.session.expenseData.name = ctx.message.text;

    // Only set date if it's not already set (initial flow)
    if (!ctx.session.expenseData.date) {
      const currentDate = new Date().toISOString().split('T')[0];

      ctx.session.expenseData.date = currentDate;
    }

    ctx.session.expenseData.step = 'complete';
    showConfirmationKeyboard(ctx);
  } else if (step === 'date') {
    let dateValue;

    if (ctx.message.text.toLowerCase() === 'today') {
      dateValue = new Date().toISOString().split('T')[0];
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      if (!dateRegex.test(ctx.message.text)) {
        ctx.reply('Please provide a valid date in YYYY-MM-DD format or type "today":');

        return;
      }
      dateValue = ctx.message.text;
    }

    ctx.session.expenseData.date = dateValue;
    ctx.session.expenseData.step = 'complete';
    showConfirmationKeyboard(ctx);
  }
});

export const addExpenseFlowScene = (ctx: BotContext) => {
  ctx.scene.enter('addExpense');
};
