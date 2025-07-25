import { Markup, Scenes } from 'telegraf';
import { BotContext } from '../types/types';

// Create the scene
export const addExpenseScene = new Scenes.BaseScene<BotContext>('addExpense');

// Entry point - ask for description
addExpenseScene.enter((ctx) => {
  ctx.session = ctx.session || {};

  // Initialize expenseData only once when entering the scene
  ctx.session.expenseData = {
    title: '',
    name: '',
    amount: 0,
    date: '',
    step: 'title', // Track which step we're on
  };

  ctx.reply(
    'Please provide a description for the expense, e.g., "Lunch at festival"',
    Markup.removeKeyboard(),
  );
});

// Show confirmation keyboard
const showConfirmationKeyboard = (ctx: BotContext) => {
  const expenseData = ctx.session.expenseData;

  ctx.reply(
    'I have the following information about you:\n' +
      `Title: ${expenseData?.title ?? 'Not set'}\n` +
      `Amount: ${expenseData?.amount ?? 'Not set'}\n` +
      `Name: ${expenseData?.name ?? 'Not set'}\n` +
      `Date: ${expenseData?.date ?? 'Not set'}\n\n` +
      'Please confirm the information below by selecting an option from the keyboard:',
    Markup.keyboard([
      ['📝 Edit description', '👤 Edit name'],
      ['💲 Edit value', '📅 Edit date'],
      ['✅ Accept'],
    ])
      .oneTime()
      .resize(),
  );
};

const getUserName = (ctx: BotContext): string => {
  if (ctx.from) {
    return `${ctx.from.first_name ?? ''} ${ctx.from.last_name ?? ''}`;
  }

  return 'Unknown';
};

// Handle description input
addExpenseScene.on('text', async (ctx) => {
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
    // Store the title and move to amount step
    ctx.session.expenseData.title = ctx.message.text;
    ctx.session.expenseData.step = 'amount';
    ctx.reply('Please provide the value of the expense, e.g., "10.50"');
  } else if (step === 'amount') {
    // Store the amount and move to name step
    const amount = Number(ctx.message.text);

    if (isNaN(amount) || amount <= 0) {
      ctx.reply('Please provide a valid number for the expense amount.');

      return;
    }

    ctx.session.expenseData.amount = amount;
    ctx.session.expenseData.step = 'name';

    const name = getUserName(ctx);

    if (name === 'Unknown') {
      ctx.reply('Unable to retrieve your name. Please provide it manually.');
    } else {
      ctx.session.expenseData.name = name;
      // Automatically set date and complete the flow
      const currentDate = new Date().toISOString().split('T')[0];

      ctx.session.expenseData.date = currentDate;
      ctx.session.expenseData.step = 'complete';
      showConfirmationKeyboard(ctx);
    }
  } else if (step === 'name') {
    // Manual name input
    ctx.session.expenseData.name = ctx.message.text;
    // Automatically set date and complete the flow
    const currentDate = new Date().toISOString().split('T')[0];

    ctx.session.expenseData.date = currentDate;
    ctx.session.expenseData.step = 'complete';
    showConfirmationKeyboard(ctx);
  }
  // Remove the 'date' step entirely since it's handled automatically
});

// Handle cancellation
addExpenseScene.command('cancel', (ctx) => {
  ctx.reply('Expense addition cancelled.');
  ctx.scene.leave();
});

export const addExpenseFlowScene = (ctx: BotContext) => {
  ctx.scene.enter('addExpense');
};
