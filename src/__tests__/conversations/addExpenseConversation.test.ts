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

jest.unstable_mockModule('../../config/i18n.js', () => ({
  i18n: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    translate: jest.fn((_locale: string, key: string, vars?: any) => {
      if (vars) {
        let result = key;

        Object.keys(vars).forEach((k) => {
          result = result.replace(`{$${k}}`, String(vars[k]));
        });

        return result;
      }

      return key;
    }),
  },
  getUserLocaleFromCache: jest.fn().mockReturnValue('en'),
}));

jest.unstable_mockModule('grammy', () => ({
  InlineKeyboard: jest.fn().mockImplementation(() => ({
    text: jest.fn().mockReturnThis(),
    row: jest.fn().mockReturnThis(),
  })),
}));

const { appendValuesToSheet } = await import('../../googleApi/googleSheetsApi.js');
const { addExpenseConversation } = await import('../../conversations/addExpenseConversation.js');

describe('addExpenseConversation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // t returns the key itself, matching what the mocked i18n.translate returns
  const t = (key: string) => key;

  const createMockCtx = (text: string, from?: unknown) => ({
    message: { text },
    from: from !== undefined ? from : { first_name: 'John', last_name: 'Doe' },
    reply: jest.fn(),
    t,
  });

  const createMockMsgCtx = (text: string) => ({
    message: { text },
    reply: jest.fn(),
    t,
  });

  const createMockCallbackCtx = (data: string) => ({
    callbackQuery: { data },
    answerCallbackQuery: jest.fn(),
    reply: jest.fn(),
    t,
  });

  it('should handle quick insert and accept', async () => {
    const ctx = createMockCtx('/expense Lunch at festival 10.50');
    const actionCtx = createMockCallbackCtx('accept');

    const conversation = {
      waitFor: jest.fn().mockResolvedValueOnce(actionCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('expense-confirmation'),
      expect.anything(),
    );
    expect(appendValuesToSheet).toHaveBeenCalledWith([
      ['Lunch at festival', '10.5', 'John Doe', expect.any(String), 'Added via Telegram Bot'],
    ]);
    expect(actionCtx.reply).toHaveBeenCalledWith('expense-success');
  });

  it('should reject quick insert with invalid amount', async () => {
    const ctx = createMockCtx('/expense Lunch at festival abc');
    const conversation = { waitFor: jest.fn() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith('expense-invalid-amount');
    expect(conversation.waitFor).not.toHaveBeenCalled();
  });

  it('should reject quick insert with too few arguments', async () => {
    const ctx = createMockCtx('/expense Lunch');
    const conversation = { waitFor: jest.fn() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith('expense-usage');
  });

  it('should handle interactive flow', async () => {
    const ctx = createMockCtx('/expense');

    const titleCtx = createMockMsgCtx('Dinner');
    const amountCtx = createMockMsgCtx('25.50');
    const actionCtx = createMockCallbackCtx('accept');

    const conversation = {
      waitFor: jest
        .fn()
        .mockResolvedValueOnce(titleCtx as never)
        .mockResolvedValueOnce(amountCtx as never)
        .mockResolvedValueOnce(actionCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith('expense-enter-description', expect.anything());
    expect(titleCtx.reply).toHaveBeenCalledWith('expense-enter-amount');

    expect(appendValuesToSheet).toHaveBeenCalledWith([
      ['Dinner', '25.5', 'John Doe', expect.any(String), 'Added via Telegram Bot'],
    ]);
  });

  it('should handle interactive flow when name is missing', async () => {
    const ctx = createMockCtx('/expense', null); // No 'from' object

    const titleCtx = createMockMsgCtx('Drinks');
    const amountCtx = createMockMsgCtx('15');
    const nameCtx = createMockMsgCtx('Jane Doe');
    const actionCtx = createMockCallbackCtx('accept');

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

    expect(amountCtx.reply).toHaveBeenCalledWith('expense-enter-name');
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

    expect(cancelCtx.reply).toHaveBeenCalledWith('expense-cancelled', expect.anything());
    expect(appendValuesToSheet).not.toHaveBeenCalled();
  });

  it('should handle /expense command as escape during interactive flow', async () => {
    const ctx = createMockCtx('/expense');
    const escapeCtx = createMockMsgCtx('/expense');

    const conversation = {
      waitFor: jest.fn().mockResolvedValueOnce(escapeCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(escapeCtx.reply).toHaveBeenCalledWith('expense-cancelled', expect.anything());
    expect(appendValuesToSheet).not.toHaveBeenCalled();
  });

  it('should retry on invalid amount in interactive flow', async () => {
    const ctx = createMockCtx('/expense');

    const titleCtx = createMockMsgCtx('Snacks');
    const invalidAmountCtx = createMockMsgCtx('abc');
    const validAmountCtx = createMockMsgCtx('5');
    const actionCtx = createMockCallbackCtx('accept');

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

    expect(invalidAmountCtx.reply).toHaveBeenCalledWith('expense-invalid-amount');
    expect(appendValuesToSheet).toHaveBeenCalledWith([
      ['Snacks', '5', 'John Doe', expect.any(String), 'Added via Telegram Bot'],
    ]);
  });

  it('should handle edit flows (edit title, edit date) before accepting', async () => {
    const ctx = createMockCtx('/expense Lunch 10'); // Quick insert to skip to confirmation

    const editTitleActionCtx = createMockCallbackCtx('edit_title');
    const newTitleCtx = createMockMsgCtx('Better Lunch');

    const editDateActionCtx = createMockCallbackCtx('edit_date');
    const invalidDateCtx = createMockMsgCtx('bad-date');
    const newDateCtx = createMockMsgCtx('25-12-2026');

    const acceptActionCtx = createMockCallbackCtx('accept');

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

    expect(editTitleActionCtx.reply).toHaveBeenCalledWith('expense-edit-title-prompt');
    expect(editDateActionCtx.reply).toHaveBeenCalledWith('expense-enter-date');
    expect(invalidDateCtx.reply).toHaveBeenCalledWith('expense-invalid-date');

    expect(appendValuesToSheet).toHaveBeenCalledWith([
      ['Better Lunch', '10', 'John Doe', '25-12-2026', 'Added via Telegram Bot'],
    ]);
  });

  it('should accept "today" keyword (localized) to set current date', async () => {
    const ctx = createMockCtx('/expense Drinks 5');

    const editDateActionCtx = createMockCallbackCtx('edit_date');
    // In tests, t('expense-today-keyword') returns 'expense-today-keyword'
    const todayCtx = createMockMsgCtx('expense-today-keyword');
    const acceptActionCtx = createMockCallbackCtx('accept');

    const conversation = {
      waitFor: jest
        .fn()
        .mockResolvedValueOnce(editDateActionCtx as never)
        .mockResolvedValueOnce(todayCtx as never)
        .mockResolvedValueOnce(acceptActionCtx as never),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addExpenseConversation(conversation as any, ctx as any);

    expect(appendValuesToSheet).toHaveBeenCalledWith([
      ['Drinks', '5', 'John Doe', expect.any(String), 'Added via Telegram Bot'],
    ]);
  });
});
