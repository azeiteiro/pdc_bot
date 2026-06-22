import { Keyboard } from 'grammy';
import type { BotContext, BotConversation } from '../types/types.js';
import { appendValuesToSheet } from '../googleApi/googleSheetsApi.js';
import { loggers } from '../utils/logger.js';
import { i18n, getUserLocaleFromCache } from '../config/i18n.js';
import type { TranslationVariables } from '@grammyjs/i18n';

type TextMsgCtx = { message: { text: string }; reply: BotContext['reply'] };

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

function isEscapeCommand(text: string): boolean {
  return text.startsWith('/cancel') || text.startsWith('/expense');
}

async function waitForTextOrExit(
  conversation: BotConversation,
  t: (key: string, vars?: TranslationVariables) => string,
): Promise<TextMsgCtx | null> {
  const msgCtx = await conversation.waitFor('message:text');

  if (isEscapeCommand(msgCtx.message.text)) {
    await msgCtx.reply(t('expense-cancelled'), { reply_markup: { remove_keyboard: true } });

    return null;
  }

  return msgCtx as unknown as TextMsgCtx;
}

export const addExpenseConversation = async (conversation: BotConversation, ctx: BotContext) => {
  const locale = getUserLocaleFromCache(ctx.from?.id);
  const t = (key: string, vars?: TranslationVariables) => i18n.translate(locale, key, vars);
  const todayKeyword = t('expense-today-keyword');

  const fullText = ctx.message?.text || '';
  const commandIndex = fullText.indexOf('/expense');
  const argsText = fullText.slice(commandIndex + 8).trim();

  let title: string;
  let amount: number;
  let name = getUserName(ctx);
  let date = formatDate(new Date());

  if (argsText) {
    // Quick insert: /expense <title> <amount>
    const args = argsText.split(' ');

    if (args.length < 2) {
      await ctx.reply(t('expense-usage'));

      return;
    }

    const valueStr = args[args.length - 1];

    title = args.slice(0, -1).join(' ');
    amount = Number(valueStr);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(t('expense-invalid-amount'));

      return;
    }
  } else {
    // Interactive flow
    await ctx.reply(t('expense-enter-description'), {
      reply_markup: { remove_keyboard: true },
    });

    const titleCtx = await waitForTextOrExit(conversation, t);

    if (!titleCtx) return;
    title = titleCtx.message.text;

    await titleCtx.reply(t('expense-enter-amount'));

    let amountCtx = await waitForTextOrExit(conversation, t);

    if (!amountCtx) return;

    while (true) {
      const parsedAmount = Number(amountCtx.message.text);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        await amountCtx.reply(t('expense-invalid-amount'));
        amountCtx = await waitForTextOrExit(conversation, t);
        if (!amountCtx) return;
      } else {
        amount = parsedAmount;
        break;
      }
    }

    if (name === 'Unknown' || !name) {
      await amountCtx.reply(t('expense-enter-name'));
      const nameCtx = await waitForTextOrExit(conversation, t);

      if (!nameCtx) return;
      name = nameCtx.message.text;
    }
  }

  // Confirmation loop
  while (true) {
    const keyboard = new Keyboard()
      .text(t('expense-edit-title'))
      .text(t('expense-edit-name'))
      .row()
      .text(t('expense-edit-value'))
      .text(t('expense-edit-date'))
      .row()
      .text(t('expense-cancel'))
      .text(t('expense-accept'))
      .oneTime()
      .resized();

    await ctx.reply(
      t('expense-confirmation', {
        title: title || t('expense-not-set'),
        amount: amount || t('expense-not-set'),
        name: name || t('expense-not-set'),
        date: date || t('expense-not-set'),
      }),
      { reply_markup: keyboard },
    );

    const actionCtx = await waitForTextOrExit(conversation, t);

    if (!actionCtx) return;

    const action = actionCtx.message.text;

    if (action === t('expense-cancel')) {
      await actionCtx.reply(t('expense-cancelled'), {
        reply_markup: { remove_keyboard: true },
      });

      return;
    }

    if (action === t('expense-accept')) {
      const values = [[title, amount.toString(), name, date, 'Added via Telegram Bot']];

      loggers.sheetsOperation(
        'addExpense',
        true,
        `Title: ${title}, Amount: ${amount}, Name: ${name}, Date: ${date}`,
      );

      try {
        await appendValuesToSheet(values);
        await actionCtx.reply(t('expense-success'), {
          reply_markup: { remove_keyboard: true },
        });
      } catch (error: unknown) {
        loggers.sheetsOperation(
          'addExpense',
          false,
          `Error adding expense: ${(error as Error).message}`,
        );
        await actionCtx.reply(t('expense-sheets-error'), {
          reply_markup: { remove_keyboard: true },
        });
      }

      return;
    }

    // Edit flows
    if (action === t('expense-edit-title')) {
      await actionCtx.reply(t('expense-edit-title-prompt'), {
        reply_markup: { remove_keyboard: true },
      });
      const editCtx = await waitForTextOrExit(conversation, t);

      if (!editCtx) return;
      title = editCtx.message.text;
    } else if (action === t('expense-edit-value')) {
      await actionCtx.reply(t('expense-edit-value-prompt'), {
        reply_markup: { remove_keyboard: true },
      });

      while (true) {
        const editCtx = await waitForTextOrExit(conversation, t);

        if (!editCtx) return;

        const parsedAmount = Number(editCtx.message.text);

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          await editCtx.reply(t('expense-invalid-amount'));
        } else {
          amount = parsedAmount;
          break;
        }
      }
    } else if (action === t('expense-edit-name')) {
      await actionCtx.reply(t('expense-edit-name-prompt'), {
        reply_markup: { remove_keyboard: true },
      });
      const editCtx = await waitForTextOrExit(conversation, t);

      if (!editCtx) return;
      name = editCtx.message.text;
    } else if (action === t('expense-edit-date')) {
      await actionCtx.reply(t('expense-enter-date'), {
        reply_markup: { remove_keyboard: true },
      });

      while (true) {
        const editCtx = await waitForTextOrExit(conversation, t);

        if (!editCtx) return;

        const text = editCtx.message.text;

        if (text.toLowerCase() === todayKeyword.toLowerCase()) {
          date = formatDate(new Date());
          break;
        } else if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
          date = text;
          break;
        } else {
          await editCtx.reply(t('expense-invalid-date'));
        }
      }
    }
  }
};
