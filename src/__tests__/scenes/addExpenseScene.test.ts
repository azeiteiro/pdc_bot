import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../googleApi/googleSheetsApi.js', () => ({
  appendValuesToSheet: jest.fn().mockResolvedValue({} as never),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  loggers: {
    sheetsOperation: jest.fn(),
  },
}));

const { appendValuesToSheet } = await import('../../googleApi/googleSheetsApi.js');
const { addExpenseConversation } = await import('../../scenes/addExpenseScene.js');

describe('addExpenseScene Conversation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockCtx = (text: string, from?: unknown) => ({
    message: { text },
    from: from !== undefined ? from : { first_name: 'John', last_name: 'Doe' },
    reply: jest.fn(),
    t: (key: string) => {
      const translations: Record<string, string> = {
        'expense-usage': 'Usage: /expense <title> <value>',
        'expense-invalid-amount': 'Please provide a valid number for the expense amount.',
        'expense-enter-description': 'Please provide a description',
        'expense-cancelled': 'Expense addition cancelled.',
        'expense-enter-amount': 'Please provide the value of the expense',
        'expense-enter-name': 'Unable to retrieve your name. Please provide it manually.',
        'expense-confirmation': 'I have the following information',
        'expense-not-set': 'Not set',
        'expense-edit-title': '📝 Edit title',
        'expense-edit-name': '👤 Edit name',
        'expense-edit-value': '💲 Edit value',
        'expense-edit-date': '📅 Edit date',
        'expense-cancel': '❌ Cancel',
        'expense-accept': '✅ Accept',
        'expense-success': 'Expense added successfully!',
        'expense-sheets-error': 'An error occurred',
        'expense-edit-title-prompt': 'Please provide a new title',
        'expense-edit-value-prompt': 'Please provide a new value',
        'expense-edit-name-prompt': "Please provide the payer's name",
        'expense-enter-date': 'Please provide the date',
        'expense-invalid-date': 'Please provide a valid date',
      };

      return translations[key] || key;
    },
  });

  const createMockMsgCtx = (text: string) => ({
    message: { text },
    reply: jest.fn(),
    t: (key: string) => {
      const translations: Record<string, string> = {
        'expense-usage': 'Usage: /expense <title> <value>',
        'expense-invalid-amount': 'Please provide a valid number for the expense amount.',
        'expense-enter-description': 'Please provide a description',
        'expense-cancelled': 'Expense addition cancelled.',
        'expense-enter-amount': 'Please provide the value of the expense',
        'expense-enter-name': 'Unable to retrieve your name. Please provide it manually.',
        'expense-confirmation': 'I have the following information',
        'expense-not-set': 'Not set',
        'expense-edit-title': '📝 Edit title',
        'expense-edit-name': '👤 Edit name',
        'expense-edit-value': '💲 Edit value',
        'expense-edit-date': '📅 Edit date',
        'expense-cancel': '❌ Cancel',
        'expense-accept': '✅ Accept',
        'expense-success': 'Expense added successfully!',
        'expense-sheets-error': 'An error occurred',
        'expense-edit-title-prompt': 'Please provide a new title',
        'expense-edit-value-prompt': 'Please provide a new value',
        'expense-edit-name-prompt': "Please provide the payer's name",
        'expense-enter-date': 'Please provide the date',
        'expense-invalid-date': 'Please provide a valid date',
      };

      return translations[key] || key;
    },
  });

  it('should handle quick insert and accept', async () => {
    const ctx = createMockCtx('/expense Lunch at festival 10.50');
    const actionCtx = createMockMsgCtx(ctx.t('expense-accept'));

    const conversation = {
      waitFor: jest.fn().mockResolvedValueOnce(actionCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('I have the following information'),
      expect.anything(),
    );
    expect(appendValuesToSheet).toHaveBeenCalledWith([
      ['Lunch at festival', '10.5', 'John Doe', expect.any(String), 'Added via Telegram Bot'],
    ]);
    expect(actionCtx.reply).toHaveBeenCalledWith('Expense added successfully!', expect.anything());
  });

  it('should reject quick insert with invalid amount', async () => {
    const ctx = createMockCtx('/expense Lunch at festival abc');
    const conversation = { waitFor: jest.fn() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith('Please provide a valid number for the expense amount.');
    expect(conversation.waitFor).not.toHaveBeenCalled();
  });

  it('should reject quick insert with too few arguments', async () => {
    const ctx = createMockCtx('/expense Lunch');
    const conversation = { waitFor: jest.fn() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Usage: /expense <title> <value>'),
    );
  });

  it('should handle interactive flow', async () => {
    const ctx = createMockCtx('/expense');

    const titleCtx = createMockMsgCtx('Dinner');
    const amountCtx = createMockMsgCtx('25.50');
    const actionCtx = createMockMsgCtx(ctx.t('expense-accept'));

    const conversation = {
      waitFor: jest
        .fn()
        .mockResolvedValueOnce(titleCtx as never)
        .mockResolvedValueOnce(amountCtx as never)
        .mockResolvedValueOnce(actionCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Please provide a description'),
      expect.anything(),
    );
    expect(titleCtx.reply).toHaveBeenCalledWith(expect.stringContaining('value of the expense'));

    expect(appendValuesToSheet).toHaveBeenCalledWith([
      ['Dinner', '25.5', 'John Doe', expect.any(String), 'Added via Telegram Bot'],
    ]);
  });

  it('should handle interactive flow when name is missing', async () => {
    const ctx = createMockCtx('/expense', null); // No 'from' object

    const titleCtx = createMockMsgCtx('Drinks');
    const amountCtx = createMockMsgCtx('15');
    const nameCtx = createMockMsgCtx('Jane Doe');
    const actionCtx = createMockMsgCtx(ctx.t('expense-accept'));

    const conversation = {
      waitFor: jest
        .fn()
        .mockResolvedValueOnce(titleCtx as never)
        .mockResolvedValueOnce(amountCtx as never)
        .mockResolvedValueOnce(nameCtx as never)
        .mockResolvedValueOnce(actionCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(amountCtx.reply).toHaveBeenCalledWith(
      'Unable to retrieve your name. Please provide it manually.',
    );
    expect(appendValuesToSheet).toHaveBeenCalledWith([
      ['Drinks', '15', 'Jane Doe', expect.any(String), 'Added via Telegram Bot'],
    ]);
  });

  it('should handle /cancel during interactive flow', async () => {
    const ctx = createMockCtx('/expense');
    const cancelCtx = createMockMsgCtx('/cancel');

    const conversation = {
      waitFor: jest.fn().mockResolvedValueOnce(cancelCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(cancelCtx.reply).toHaveBeenCalledWith('Expense addition cancelled.', expect.anything());
    expect(appendValuesToSheet).not.toHaveBeenCalled();
  });

  it('should retry on invalid amount in interactive flow', async () => {
    const ctx = createMockCtx('/expense');

    const titleCtx = createMockMsgCtx('Snacks');
    const invalidAmountCtx = createMockMsgCtx('abc');
    const validAmountCtx = createMockMsgCtx('5');
    const actionCtx = createMockMsgCtx(ctx.t('expense-accept'));

    const conversation = {
      waitFor: jest
        .fn()
        .mockResolvedValueOnce(titleCtx as never)
        .mockResolvedValueOnce(invalidAmountCtx as never)
        .mockResolvedValueOnce(validAmountCtx as never)
        .mockResolvedValueOnce(actionCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(invalidAmountCtx.reply).toHaveBeenCalledWith(
      'Please provide a valid number for the expense amount.',
    );
    expect(appendValuesToSheet).toHaveBeenCalledWith([
      ['Snacks', '5', 'John Doe', expect.any(String), 'Added via Telegram Bot'],
    ]);
  });

  it('should handle edit flows (edit title, edit date) before accepting', async () => {
    const ctx = createMockCtx('/expense Lunch 10'); // Quick insert to skip to confirmation

    const editTitleActionCtx = createMockMsgCtx(ctx.t('expense-edit-title'));
    const newTitleCtx = createMockMsgCtx('Better Lunch');

    const editDateActionCtx = createMockMsgCtx(ctx.t('expense-edit-date'));
    const invalidDateCtx = createMockMsgCtx('bad-date');
    const newDateCtx = createMockMsgCtx('2026-12-25');

    const acceptActionCtx = createMockMsgCtx(ctx.t('expense-accept'));

    const conversation = {
      waitFor: jest
        .fn()
        .mockResolvedValueOnce(editTitleActionCtx as never)
        .mockResolvedValueOnce(newTitleCtx as never)
        .mockResolvedValueOnce(editDateActionCtx as never)
        .mockResolvedValueOnce(invalidDateCtx as never)
        .mockResolvedValueOnce(newDateCtx as never)
        .mockResolvedValueOnce(acceptActionCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(editTitleActionCtx.reply).toHaveBeenCalledWith(
      'Please provide a new title',
      expect.anything(),
    );
    expect(editDateActionCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Please provide the date'),
      expect.anything(),
    );
    expect(invalidDateCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Please provide a valid date'),
    );

    expect(appendValuesToSheet).toHaveBeenCalledWith([
      ['Better Lunch', '10', 'John Doe', '2026-12-25', 'Added via Telegram Bot'],
    ]);
  });
});
