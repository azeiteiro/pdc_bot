# i18n Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add English and Portuguese translations to the expense conversation using @grammyjs/i18n

**Architecture:** Install @grammyjs/i18n, configure middleware before conversations, extend BotContext with I18nFlavor, create Fluent translation files, refactor addExpenseScene to use ctx.t(), update date format to DD-MM-YYYY, and update tests.

**Tech Stack:** @grammyjs/i18n (Fluent), TypeScript, grammY, Jest

---

## File Structure Overview

**Files to create:**
- `src/locales/en.ftl` - English translations (Fluent format)
- `src/locales/pt.ftl` - European Portuguese translations
- `.prettierignore` - Add .ftl files to ignore list (if file doesn't exist)

**Files to modify:**
- `package.json` - Add @grammyjs/i18n dependency
- `src/types/types.ts` - Add I18nFlavor to BotContext
- `src/bots/mainBot.ts` - Configure and apply i18n middleware
- `src/scenes/addExpenseScene.ts` - Replace hardcoded strings with ctx.t(), change date format
- `src/__tests__/scenes/addExpenseScene.test.ts` - Add t() mock to test contexts

---

### Task 1: Install Dependencies and Configure Prettier

**Files:**
- Modify: `package.json`
- Create/Modify: `.prettierignore`

- [ ] **Step 1: Install @grammyjs/i18n**

Run: `pnpm add @grammyjs/i18n`

Expected: Package installed successfully

- [ ] **Step 2: Verify installation**

Run: `pnpm list @grammyjs/i18n`

Expected: Shows installed version (should be ^1.0.2 or higher)

- [ ] **Step 3: Add .ftl files to .prettierignore**

Check if `.prettierignore` exists, if not create it. Add this line:

```
src/locales/*.ftl
```

- [ ] **Step 4: Commit dependency changes**

```bash
git add package.json pnpm-lock.yaml .prettierignore
git commit -m "feat: add @grammyjs/i18n dependency and ignore .ftl files"
```

---

### Task 2: Create English Translation File

**Files:**
- Create: `src/locales/en.ftl`

- [ ] **Step 1: Create locales directory**

Run: `mkdir -p src/locales`

- [ ] **Step 2: Create English translation file**

Create `src/locales/en.ftl` with this content:

```ftl
# Expense conversation translations (English)

# Usage instructions
expense-usage = Usage: /expense <title> <value>
    Example: /expense Lunch at festival 10.50
    Or just /expense for interactive mode

# Interactive flow prompts
expense-enter-description = Please provide a description for the expense, e.g., "Lunch at festival"

    Type /cancel at any time to exit.

expense-enter-amount = Please provide the value of the expense, e.g., "10.50"

expense-enter-name = Unable to retrieve your name. Please provide it manually.

expense-enter-date = Please provide the date (DD-MM-YYYY) or type "today" for current date

# Validation errors
expense-invalid-amount = Please provide a valid number for the expense amount.

expense-invalid-date = Please provide a valid date in DD-MM-YYYY format or type "today"

# Confirmation message
expense-confirmation = I have the following information about you:
    Title: {$title}
    Amount: €{$amount}
    Name: {$name}
    Date: {$date}

    Please confirm the information below by selecting an option from the keyboard:

# Keyboard button labels
expense-edit-title = 📝 Edit title

expense-edit-name = 👤 Edit name

expense-edit-value = 💲 Edit value

expense-edit-date = 📅 Edit date

expense-cancel = ❌ Cancel

expense-accept = ✅ Accept

# Edit prompts
expense-edit-title-prompt = Please provide a new title for the expense:

expense-edit-value-prompt = Please provide a new value for the expense, e.g., "10.50":

expense-edit-name-prompt = Please provide the payer's name:

# Status messages
expense-success = Expense added successfully!

expense-cancelled = Expense addition cancelled.

expense-sheets-error = An error occurred while adding the expense. Please try again later.

expense-no-spreadsheet = Google Spreadsheet ID is not set. Please contact the administrator.

# Placeholder values
expense-not-set = Not set
```

- [ ] **Step 3: Verify file was created**

Run: `cat src/locales/en.ftl | head -20`

Expected: Shows first 20 lines of the translation file

- [ ] **Step 4: Commit English translations**

```bash
git add src/locales/en.ftl
git commit -m "feat: add English translations for expense conversation"
```

---

### Task 3: Create Portuguese Translation File

**Files:**
- Create: `src/locales/pt.ftl`

- [ ] **Step 1: Create Portuguese translation file**

Create `src/locales/pt.ftl` with this content (European Portuguese):

```ftl
# Traduções da conversa de despesas (Português Europeu)

# Instruções de uso
expense-usage = Utilização: /expense <título> <valor>
    Exemplo: /expense Almoço no festival 10.50
    Ou apenas /expense para modo interativo

# Prompts do fluxo interativo
expense-enter-description = Por favor, forneça uma descrição para a despesa, por exemplo, "Almoço no festival"

    Digite /cancel a qualquer momento para sair.

expense-enter-amount = Por favor, forneça o valor da despesa, por exemplo, "10.50"

expense-enter-name = Não foi possível obter o seu nome. Por favor, forneça-o manualmente.

expense-enter-date = Por favor, forneça a data (DD-MM-YYYY) ou digite "today" para a data atual

# Erros de validação
expense-invalid-amount = Por favor, forneça um número válido para o valor da despesa.

expense-invalid-date = Por favor, forneça uma data válida no formato DD-MM-YYYY ou digite "today"

# Mensagem de confirmação
expense-confirmation = Tenho a seguinte informação:
    Título: {$title}
    Valor: €{$amount}
    Nome: {$name}
    Data: {$date}

    Por favor, confirme a informação abaixo selecionando uma opção do teclado:

# Etiquetas dos botões do teclado
expense-edit-title = 📝 Editar título

expense-edit-name = 👤 Editar nome

expense-edit-value = 💲 Editar valor

expense-edit-date = 📅 Editar data

expense-cancel = ❌ Cancelar

expense-accept = ✅ Aceitar

# Prompts de edição
expense-edit-title-prompt = Por favor, forneça um novo título para a despesa:

expense-edit-value-prompt = Por favor, forneça um novo valor para a despesa, por exemplo, "10.50":

expense-edit-name-prompt = Por favor, forneça o nome do pagador:

# Mensagens de estado
expense-success = Despesa adicionada com sucesso!

expense-cancelled = Adição de despesa cancelada.

expense-sheets-error = Ocorreu um erro ao adicionar a despesa. Por favor, tente novamente mais tarde.

expense-no-spreadsheet = O ID da folha de cálculo do Google não está configurado. Por favor, contacte o administrador.

# Valores de placeholder
expense-not-set = Não definido
```

- [ ] **Step 2: Verify file was created**

Run: `cat src/locales/pt.ftl | head -20`

Expected: Shows first 20 lines of the Portuguese translation file

- [ ] **Step 3: Verify both files have identical keys**

Run: `diff <(grep '^[a-z]' src/locales/en.ftl | cut -d' ' -f1) <(grep '^[a-z]' src/locales/pt.ftl | cut -d' ' -f1)`

Expected: No output (files have same keys)

- [ ] **Step 4: Commit Portuguese translations**

```bash
git add src/locales/pt.ftl
git commit -m "feat: add European Portuguese translations for expense conversation"
```

---

### Task 4: Update Type Definitions

**Files:**
- Modify: `src/types/types.ts:1-129`

- [ ] **Step 1: Add I18nFlavor import**

In `src/types/types.ts`, add this import at the top after the existing imports:

```typescript
import { I18nFlavor } from '@grammyjs/i18n';
```

The imports section should now look like:

```typescript
import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor, Conversation } from '@grammyjs/conversations';
import { HydrateFlavor } from '@grammyjs/hydrate';
import { I18nFlavor } from '@grammyjs/i18n';
```

- [ ] **Step 2: Update BotContext type**

Find the `BotContext` type definition (around line 125) and add `I18nFlavor`:

```typescript
export type BotContext = HydrateFlavor<Context> &
  SessionFlavor<SessionData> &
  ConversationFlavor<Context> &
  I18nFlavor;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`

Expected: No errors

- [ ] **Step 4: Commit type changes**

```bash
git add src/types/types.ts
git commit -m "feat: add I18nFlavor to BotContext type"
```

---

### Task 5: Configure i18n Middleware

**Files:**
- Modify: `src/bots/mainBot.ts:1-90`

- [ ] **Step 1: Add i18n import**

In `src/bots/mainBot.ts`, add this import at the top after the existing imports (around line 6):

```typescript
import { I18n } from '@grammyjs/i18n';
```

The imports section should now include:

```typescript
import { hydrate } from '@grammyjs/hydrate';
import { autoRetry } from '@grammyjs/auto-retry';
import { Bot, session } from 'grammy';
import { run } from '@grammyjs/runner';
import { conversations, createConversation } from '@grammyjs/conversations';
import { I18n } from '@grammyjs/i18n';
import type { BotContext, SessionData } from '../types/types.js';
```

- [ ] **Step 2: Create i18n configuration**

In the `initializeBot()` function, add the i18n configuration before `bot.use(hydrate())` (around line 28):

```typescript
const initializeBot = (): Bot<BotContext> => {
  const botToken = () => {
    switch (process.env.NODE_ENV) {
      case 'development':
        return process.env.BOT_DEVELOPMENT_TOKEN;
      case 'staging':
        return process.env.BOT_STAGING_TOKEN;
      case 'production':
        return process.env.BOT_PRODUCTION_TOKEN;
      default:
        return process.env.BOT_DEVELOPMENT_TOKEN;
    }
  };

  const bot = new Bot<BotContext>(botToken()!);

  // Configure i18n
  const i18n = new I18n<BotContext>({
    defaultLocale: 'en',
    directory: 'src/locales',
    useSession: false,
    localeNegotiator: (ctx) => {
      const userLang = ctx.from?.language_code;

      // Map all Portuguese variants to pt (European Portuguese)
      if (userLang?.startsWith('pt')) return 'pt';

      // Default to English for everything else
      return 'en';
    },
  });

  // Enable context hydration
  bot.use(hydrate());
```

- [ ] **Step 3: Add i18n middleware**

After `bot.use(hydrate())` and before `bot.api.config.use(autoRetry(...))`, add:

```typescript
  // Enable context hydration
  bot.use(hydrate());

  // Enable i18n (must come before conversations)
  bot.use(i18n);

  // Enable automatic retry for failed API calls
  bot.api.config.use(
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`

Expected: No errors

- [ ] **Step 5: Commit middleware configuration**

```bash
git add src/bots/mainBot.ts
git commit -m "feat: configure i18n middleware with Portuguese and English support"
```

---

### Task 6: Add Date Formatting Helper

**Files:**
- Modify: `src/scenes/addExpenseScene.ts:1-23`

- [ ] **Step 1: Add formatDate helper function**

In `src/scenes/addExpenseScene.ts`, add this helper function after the `getUserName` function (after line 12):

```typescript
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
```

- [ ] **Step 2: Replace date initialization**

Find line 23 where date is initialized:

```typescript
// OLD:
let date = new Date().toISOString().split('T')[0];

// NEW:
let date = formatDate(new Date());
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`

Expected: No errors

- [ ] **Step 4: Commit date helper**

```bash
git add src/scenes/addExpenseScene.ts
git commit -m "feat: add formatDate helper for DD-MM-YYYY format"
```

---

### Task 7: Refactor Quick Insert Error Messages

**Files:**
- Modify: `src/scenes/addExpenseScene.ts:26-46`

- [ ] **Step 1: Replace usage message**

Find the usage message (around line 30-32) and replace:

```typescript
// OLD:
if (args.length < 2) {
  await ctx.reply(
    'Usage: /expense <title> <value>\nExample: /expense Lunch at festival 10.50\nOr just /expense for interactive mode',
  );

  return;
}

// NEW:
if (args.length < 2) {
  await ctx.reply(ctx.t('expense-usage'));

  return;
}
```

- [ ] **Step 2: Replace invalid amount message**

Find the invalid amount check (around line 42-45) and replace:

```typescript
// OLD:
if (isNaN(amount) || amount <= 0) {
  await ctx.reply('Please provide a valid number for the expense amount.');

  return;
}

// NEW:
if (isNaN(amount) || amount <= 0) {
  await ctx.reply(ctx.t('expense-invalid-amount'));

  return;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`

Expected: No errors

- [ ] **Step 4: Commit quick insert refactoring**

```bash
git add src/scenes/addExpenseScene.ts
git commit -m "refactor: use i18n for quick insert error messages"
```

---

### Task 8: Refactor Interactive Flow Prompts

**Files:**
- Modify: `src/scenes/addExpenseScene.ts:47-100`

- [ ] **Step 1: Replace description prompt**

Find the interactive flow start (around line 49-53) and replace:

```typescript
// OLD:
await ctx.reply(
  'Please provide a description for the expense, e.g., "Lunch at festival"\n\n' +
    'Type /cancel at any time to exit.',
  { reply_markup: { remove_keyboard: true } },
);

// NEW:
await ctx.reply(ctx.t('expense-enter-description'), {
  reply_markup: { remove_keyboard: true },
});
```

- [ ] **Step 2: Replace first cancellation message**

Find the cancellation after description (around line 57-60) and replace:

```typescript
// OLD:
if (msgCtx.message.text.toLowerCase() === '/cancel') {
  await msgCtx.reply('Expense addition cancelled.', {
    reply_markup: { remove_keyboard: true },
  });

  return;
}

// NEW:
if (msgCtx.message.text.toLowerCase() === '/cancel') {
  await msgCtx.reply(ctx.t('expense-cancelled'), {
    reply_markup: { remove_keyboard: true },
  });

  return;
}
```

- [ ] **Step 3: Replace amount prompt**

Find the amount prompt (around line 66) and replace:

```typescript
// OLD:
await msgCtx.reply('Please provide the value of the expense, e.g., "10.50"');

// NEW:
await msgCtx.reply(ctx.t('expense-enter-amount'));
```

- [ ] **Step 4: Replace amount validation messages**

Find the amount validation loop (around line 71-82) and replace:

```typescript
// OLD:
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

// NEW:
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
```

- [ ] **Step 5: Replace name prompt**

Find the name prompt (around line 89-99) and replace:

```typescript
// OLD:
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

// NEW:
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
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`

Expected: No errors

- [ ] **Step 7: Commit interactive flow refactoring**

```bash
git add src/scenes/addExpenseScene.ts
git commit -m "refactor: use i18n for interactive flow prompts"
```

---

### Task 9: Refactor Confirmation Loop

**Files:**
- Modify: `src/scenes/addExpenseScene.ts:103-165`

- [ ] **Step 1: Replace keyboard button labels**

Find the keyboard creation (around line 105-115) and replace:

```typescript
// OLD:
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

// NEW:
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
```

- [ ] **Step 2: Replace confirmation message**

Find the confirmation message (around line 117-125) and replace:

```typescript
// OLD:
await ctx.reply(
  'I have the following information about you:\n' +
    `Title: ${title || 'Not set'}\n` +
    `Amount: €${amount || 'Not set'}\n` +
    `Name: ${name || 'Not set'}\n` +
    `Date: ${date || 'Not set'}\n\n` +
    'Please confirm the information below by selecting an option from the keyboard:',
  { reply_markup: keyboard },
);

// NEW:
await ctx.reply(
  ctx.t('expense-confirmation', {
    title: title || ctx.t('expense-not-set'),
    amount: amount || ctx.t('expense-not-set'),
    name: name || ctx.t('expense-not-set'),
    date: date || ctx.t('expense-not-set'),
  }),
  { reply_markup: keyboard },
);
```

- [ ] **Step 3: Update cancel button check**

Find the cancel check (around line 130-135) and update to use translated button text:

```typescript
// OLD:
if (action === '❌ Cancel' || action.toLowerCase() === '/cancel') {
  await actionCtx.reply('Expense addition cancelled.', {
    reply_markup: { remove_keyboard: true },
  });

  return;
}

// NEW:
if (action === ctx.t('expense-cancel') || action.toLowerCase() === '/cancel') {
  await actionCtx.reply(ctx.t('expense-cancelled'), {
    reply_markup: { remove_keyboard: true },
  });

  return;
}
```

- [ ] **Step 4: Update accept button check and messages**

Find the accept check (around line 138-162) and replace:

```typescript
// OLD:
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

// NEW:
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
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`

Expected: No errors

- [ ] **Step 6: Commit confirmation loop refactoring**

```bash
git add src/scenes/addExpenseScene.ts
git commit -m "refactor: use i18n for confirmation loop and status messages"
```

---

### Task 10: Refactor Edit Flows

**Files:**
- Modify: `src/scenes/addExpenseScene.ts:167-217`

- [ ] **Step 1: Replace edit title flow**

Find the edit title flow (around line 168-174) and replace:

```typescript
// OLD:
if (action === '📝 Edit title') {
  await actionCtx.reply('Please provide a new title for the expense:', {
    reply_markup: { remove_keyboard: true },
  });
  const editCtx = await conversation.waitFor('message:text');

  title = editCtx.message.text;
}

// NEW:
if (action === ctx.t('expense-edit-title')) {
  await actionCtx.reply(ctx.t('expense-edit-title-prompt'), {
    reply_markup: { remove_keyboard: true },
  });
  const editCtx = await conversation.waitFor('message:text');

  title = editCtx.message.text;
}
```

- [ ] **Step 2: Replace edit value flow**

Find the edit value flow (around line 175-189) and replace:

```typescript
// OLD:
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
}

// NEW:
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
}
```

- [ ] **Step 3: Replace edit name flow**

Find the edit name flow (around line 190-196) and replace:

```typescript
// OLD:
} else if (action === '👤 Edit name') {
  await actionCtx.reply("Please provide the payer's name:", {
    reply_markup: { remove_keyboard: true },
  });
  const editCtx = await conversation.waitFor('message:text');

  name = editCtx.message.text;
}

// NEW:
} else if (action === ctx.t('expense-edit-name')) {
  await actionCtx.reply(ctx.t('expense-edit-name-prompt'), {
    reply_markup: { remove_keyboard: true },
  });
  const editCtx = await conversation.waitFor('message:text');

  name = editCtx.message.text;
}
```

- [ ] **Step 4: Replace edit date flow**

Find the edit date flow (around line 197-215) and replace:

```typescript
// OLD:
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

// NEW:
} else if (action === ctx.t('expense-edit-date')) {
  await actionCtx.reply(ctx.t('expense-enter-date'), {
    reply_markup: { remove_keyboard: true },
  });
  while (true) {
    const editCtx = await conversation.waitFor('message:text');
    const text = editCtx.message.text;

    if (text.toLowerCase() === 'today') {
      date = formatDate(new Date());
      break;
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
      date = text;
      break;
    } else {
      await editCtx.reply(ctx.t('expense-invalid-date'));
    }
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`

Expected: No errors

- [ ] **Step 6: Commit edit flows refactoring**

```bash
git add src/scenes/addExpenseScene.ts
git commit -m "refactor: use i18n for edit flows and update date format validation"
```

---

### Task 11: Update Test Mocks

**Files:**
- Modify: `src/__tests__/scenes/addExpenseScene.test.ts:22-31`

- [ ] **Step 1: Add t() mock to createMockCtx**

Find the `createMockCtx` function (around line 22-26) and add the `t` method:

```typescript
// OLD:
const createMockCtx = (text: string, from?: unknown) => ({
  message: { text },
  from: from !== undefined ? from : { first_name: 'John', last_name: 'Doe' },
  reply: jest.fn(),
});

// NEW:
const createMockCtx = (text: string, from?: unknown) => ({
  message: { text },
  from: from !== undefined ? from : { first_name: 'John', last_name: 'Doe' },
  reply: jest.fn(),
  t: (key: string, vars?: Record<string, unknown>) => {
    // Simple mock that returns the key for testing
    if (vars) {
      // For testing, return key with interpolated values
      return `${key}:${JSON.stringify(vars)}`;
    }
    return key;
  },
});
```

- [ ] **Step 2: Add t() mock to createMockMsgCtx**

Find the `createMockMsgCtx` function (around line 28-31) and add the `t` method:

```typescript
// OLD:
const createMockMsgCtx = (text: string) => ({
  message: { text },
  reply: jest.fn(),
});

// NEW:
const createMockMsgCtx = (text: string) => ({
  message: { text },
  reply: jest.fn(),
  t: (key: string, vars?: Record<string, unknown>) => {
    // Simple mock that returns the key for testing
    if (vars) {
      return `${key}:${JSON.stringify(vars)}`;
    }
    return key;
  },
});
```

- [ ] **Step 3: Run tests to see which assertions need updating**

Run: `pnpm test src/__tests__/scenes/addExpenseScene.test.ts`

Expected: Some tests will fail because they check for hardcoded strings that are now translation keys

- [ ] **Step 4: Update test assertions to check for translation keys**

Update the test expectations to match the new translation key returns:

```typescript
// Test: should handle quick insert and accept
// Line 44-46: Update confirmation check
expect(ctx.reply).toHaveBeenCalledWith(
  expect.stringContaining('expense-confirmation'),
  expect.anything(),
);

// Line 51: Update success message check
expect(actionCtx.reply).toHaveBeenCalledWith('expense-success', expect.anything());

// Test: should reject quick insert with invalid amount
// Line 61: Update error message check
expect(ctx.reply).toHaveBeenCalledWith('expense-invalid-amount');

// Test: should reject quick insert with too few arguments
// Line 72-74: Update usage message check
expect(ctx.reply).toHaveBeenCalledWith('expense-usage');

// Test: should handle interactive flow
// Line 95-97: Update description prompt check
expect(ctx.reply).toHaveBeenCalledWith(
  'expense-enter-description',
  expect.anything(),
);

// Line 99: Update amount prompt check
expect(titleCtx.reply).toHaveBeenCalledWith('expense-enter-amount');

// Test: should handle interactive flow when name is missing
// Line 126-128: Update name prompt check
expect(amountCtx.reply).toHaveBeenCalledWith('expense-enter-name');

// Test: should handle /cancel during interactive flow
// Line 145: Update cancellation message check
expect(cancelCtx.reply).toHaveBeenCalledWith('expense-cancelled', expect.anything());

// Test: should retry on invalid amount in interactive flow
// Line 169-171: Update invalid amount check
expect(invalidAmountCtx.reply).toHaveBeenCalledWith('expense-invalid-amount');

// Test: should handle edit flows
// Line 203-206: Update title prompt check
expect(editTitleActionCtx.reply).toHaveBeenCalledWith(
  'expense-edit-title-prompt',
  expect.anything(),
);

// Line 207-210: Update date prompt check
expect(editDateActionCtx.reply).toHaveBeenCalledWith(
  'expense-enter-date',
  expect.anything(),
);

// Line 211-213: Update invalid date check
expect(invalidDateCtx.reply).toHaveBeenCalledWith('expense-invalid-date');
```

- [ ] **Step 5: Update button text comparisons in tests**

Update test keyboard button text to use translation keys:

```typescript
// Line 180: Update keyboard button text
const editTitleActionCtx = createMockMsgCtx('expense-edit-title');

// Line 183: Update keyboard button text
const editDateActionCtx = createMockMsgCtx('expense-edit-date');

// Line 187: Update keyboard button text
const acceptActionCtx = createMockMsgCtx('expense-accept');

// Line 35, 83, 112, etc: Update accept button text throughout
const actionCtx = createMockMsgCtx('expense-accept');
```

- [ ] **Step 6: Run tests again**

Run: `pnpm test src/__tests__/scenes/addExpenseScene.test.ts`

Expected: All tests pass

- [ ] **Step 7: Commit test updates**

```bash
git add src/__tests__/scenes/addExpenseScene.test.ts
git commit -m "test: update expense scene tests to work with i18n"
```

---

### Task 12: Run Full Test Suite and Build

**Files:**
- None (validation only)

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`

Expected: All tests pass with coverage report

- [ ] **Step 2: Check for TypeScript errors**

Run: `pnpm exec tsc --noEmit`

Expected: No errors

- [ ] **Step 3: Run linter**

Run: `pnpm lint`

Expected: No linting errors

- [ ] **Step 4: Build the project**

Run: `pnpm build`

Expected: Build succeeds, dist/ directory created with locales copied

- [ ] **Step 5: Verify locales copied to dist**

Run: `ls -la dist/locales/`

Expected: Shows en.ftl and pt.ftl files

Note: If locales are not copied, the build script may need updating. The tsup config should include a copy step or the build script already has `cp -r src/resources dist/` which may need to be extended.

- [ ] **Step 6: Check if build script needs locale copying**

If locales weren't copied, update the build script in package.json:

```json
"build": "tsup && cp -r src/resources dist/ && cp -r src/locales dist/"
```

Then re-run: `pnpm build`

- [ ] **Step 7: Commit build script update if needed**

```bash
git add package.json
git commit -m "build: ensure locales are copied to dist directory"
```

---

### Task 13: Manual Testing

**Files:**
- None (manual testing)

- [ ] **Step 1: Start development server**

Run: `pnpm dev`

Expected: Bot starts successfully with message "🚀 Bot started with grammY runner"

Check logs for i18n loading messages. No errors about missing translation files.

- [ ] **Step 2: Test English user flow**

In Telegram (with language set to English or any non-Portuguese language):

1. Send `/expense` (interactive mode)
2. Verify prompt is in English
3. Provide description: `Test lunch`
4. Provide amount: `15.50`
5. Verify confirmation shows correct format
6. Select "✅ Accept"
7. Verify success message in English

Expected: All messages in English, date in DD-MM-YYYY format

- [ ] **Step 3: Test Portuguese user flow**

Change Telegram language to Portuguese (or use a different account with Portuguese set).

1. Send `/expense` (interactive mode)
2. Verify prompt is in Portuguese (European)
3. Provide description: `Almoço de teste`
4. Provide amount: `12.50`
5. Verify confirmation in Portuguese
6. Select "✅ Aceitar"
7. Verify success message in Portuguese

Expected: All messages in European Portuguese

- [ ] **Step 4: Test quick insert**

Send: `/expense Coffee 3.50`

Expected: Confirmation with English or Portuguese based on user language

- [ ] **Step 5: Test edit flows**

1. Send `/expense Dinner 20`
2. Select "📝 Edit title" (or Portuguese equivalent)
3. Change title to `Dinner updated`
4. Select "📅 Edit date"
5. Enter: `25-12-2026`
6. Verify date accepted
7. Select "✅ Accept"

Expected: Edit prompts in correct language, date format validation works

- [ ] **Step 6: Test error cases**

1. Send `/expense InvalidAmount abc`
   - Expected: Error in user's language
2. Send `/expense` then invalid amount `xyz`
   - Expected: Retry prompt in user's language
3. In edit date, enter invalid format `2026-12-25`
   - Expected: Error asking for DD-MM-YYYY format
4. In edit date, enter `today`
   - Expected: Sets today's date in DD-MM-YYYY

- [ ] **Step 7: Test cancellation**

1. Send `/expense`
2. Type `/cancel`
3. Verify cancellation message in correct language

- [ ] **Step 8: Stop development server**

Press Ctrl+C

Expected: Server stops gracefully

---

### Task 14: Final Verification and Documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-04-28-i18n-design.md` (mark success criteria as complete)

- [ ] **Step 1: Verify translation key parity**

Run: `diff <(grep '^[a-z]' src/locales/en.ftl | cut -d' ' -f1 | sort) <(grep '^[a-z]' src/locales/pt.ftl | cut -d' ' -f1 | sort)`

Expected: No output (both files have identical keys)

- [ ] **Step 2: Run final test suite**

Run: `pnpm test --coverage`

Expected: All tests pass, good coverage maintained

- [ ] **Step 3: Check all files are committed**

Run: `git status`

Expected: No uncommitted changes or only documentation updates

- [ ] **Step 4: Update success criteria in design spec**

Edit `docs/superpowers/specs/2026-04-28-i18n-design.md` and mark all success criteria as complete:

```markdown
## Success Criteria

- [x] Both English and Portuguese users can complete expense flow
- [x] Language auto-detected correctly from Telegram settings
- [x] Unsupported languages fall back to English
- [x] All expense conversation text is translatable
- [x] Date format changed to DD-MM-YYYY
- [x] Existing tests pass with updated mocks
- [x] No TypeScript errors
- [x] Manual testing confirms both languages work
```

- [ ] **Step 5: Commit spec update**

```bash
git add docs/superpowers/specs/2026-04-28-i18n-design.md
git commit -m "docs: mark i18n success criteria as complete"
```

- [ ] **Step 6: Review all commits**

Run: `git log --oneline --since="today"`

Expected: Clean commit history with descriptive messages following conventional commits format

---

## Implementation Complete

All tasks completed. The expense conversation now supports English and Portuguese with automatic language detection, DD-MM-YYYY date format, and full test coverage.

**Key changes:**
- Added @grammyjs/i18n with Fluent translation files
- Extended BotContext with I18nFlavor
- Configured i18n middleware with Portuguese/English support
- Refactored all hardcoded strings to use ctx.t()
- Changed date format from YYYY-MM-DD to DD-MM-YYYY
- Updated tests to work with i18n mocks

**Next steps:**
- Monitor for any runtime issues with translations
- Consider expanding i18n to other commands (lineup, help, info)
- Consider adding more languages if needed
