# Manual Language Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/language` command with SQLite-based persistent session storage for user language preferences.

**Architecture:** Migrate session storage from in-memory to SQLite using better-sqlite3. Add `preferredLanguage` field to SessionData. Update i18n localeNegotiator to check session preference first. Implement `/language` command with inline keyboard for language selection.

**Tech Stack:** better-sqlite3, grammY session middleware, @grammyjs/i18n, TypeScript

---

## File Structure

### New Files
- `src/storage/sqliteAdapter.ts` - SQLite storage adapter for grammY sessions
- `src/botsCommands/languageCommand.ts` - Language command and callback handlers
- `src/__tests__/storage/sqliteAdapter.test.ts` - Storage adapter tests
- `src/__tests__/botsCommands/languageCommand.test.ts` - Language command tests
- `src/__tests__/config/i18n.test.ts` - i18n localeNegotiator tests

### Modified Files
- `package.json` - Add better-sqlite3 and @types/better-sqlite3
- `src/types/types.ts` - Add `preferredLanguage` to SessionData
- `src/config/i18n.ts` - Update localeNegotiator to check session preference
- `src/bots/mainBot.ts` - Register language command, use SQLite storage
- `src/locales/en.ftl` - Add language selection translations
- `src/locales/pt.ftl` - Add language selection translations
- `.gitignore` - Add sessions.db files

---

## Task 1: Add Dependencies and Update .gitignore

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add better-sqlite3 dependencies to package.json**

Add to dependencies:
```json
"better-sqlite3": "^11.0.0"
```

Add to devDependencies:
```json
"@types/better-sqlite3": "^7.6.0"
```

- [ ] **Step 2: Install dependencies**

Run: `pnpm install`
Expected: Dependencies installed successfully

- [ ] **Step 3: Add SQLite files to .gitignore**

Add these lines to `.gitignore`:
```
sessions.db
sessions.db-journal
```

- [ ] **Step 4: Commit changes**

```bash
git add package.json pnpm-lock.yaml .gitignore
git commit -m "chore: add better-sqlite3 dependency and ignore session db files"
```

---

## Task 2: Update SessionData Type

**Files:**
- Modify: `src/types/types.ts:116-124`

- [ ] **Step 1: Write failing test for SessionData type**

Create: `src/__tests__/types/types.test.ts`

```typescript
import type { SessionData } from '../../types/types.js';

describe('SessionData', () => {
  it('should allow preferredLanguage to be undefined', () => {
    const sessionData: SessionData = {
      expenseData: undefined,
    };

    expect(sessionData.preferredLanguage).toBeUndefined();
  });

  it('should allow preferredLanguage to be en', () => {
    const sessionData: SessionData = {
      expenseData: undefined,
      preferredLanguage: 'en',
    };

    expect(sessionData.preferredLanguage).toBe('en');
  });

  it('should allow preferredLanguage to be pt', () => {
    const sessionData: SessionData = {
      expenseData: undefined,
      preferredLanguage: 'pt',
    };

    expect(sessionData.preferredLanguage).toBe('pt');
  });

  it('should not allow invalid language codes', () => {
    // @ts-expect-error - Testing type safety
    const sessionData: SessionData = {
      expenseData: undefined,
      preferredLanguage: 'es',
    };

    // This test verifies TypeScript prevents invalid values
    expect(sessionData).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/types/types.test.ts`
Expected: FAIL - preferredLanguage does not exist on type SessionData

- [ ] **Step 3: Add preferredLanguage to SessionData**

Modify `src/types/types.ts:116-124`:

```typescript
export interface SessionData {
  expenseData?: {
    title: string;
    name: string;
    amount: number;
    date: string;
    description?: string;
  };
  preferredLanguage?: 'en' | 'pt';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/types/types.test.ts`
Expected: PASS - All tests pass

- [ ] **Step 5: Commit changes**

```bash
git add src/types/types.ts src/__tests__/types/types.test.ts
git commit -m "feat: add preferredLanguage field to SessionData type"
```

---

## Task 3: Implement SQLite Storage Adapter

**Files:**
- Create: `src/storage/sqliteAdapter.ts`
- Create: `src/__tests__/storage/sqliteAdapter.test.ts`

- [ ] **Step 1: Write failing test for storage adapter initialization**

Create: `src/__tests__/storage/sqliteAdapter.test.ts`

```typescript
import Database from 'better-sqlite3';
import { createSqliteStorage } from '../../storage/sqliteAdapter.js';

describe('SQLite Storage Adapter', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Use in-memory database for tests
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('createSqliteStorage', () => {
    it('should create sessions table on initialization', () => {
      createSqliteStorage(db);

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
        .all();

      expect(tables).toHaveLength(1);
      expect(tables[0]).toEqual({ name: 'sessions' });
    });

    it('should return storage adapter with read, write, delete methods', () => {
      const storage = createSqliteStorage(db);

      expect(storage).toHaveProperty('read');
      expect(storage).toHaveProperty('write');
      expect(storage).toHaveProperty('delete');
      expect(typeof storage.read).toBe('function');
      expect(typeof storage.write).toBe('function');
      expect(typeof storage.delete).toBe('function');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/storage/sqliteAdapter.test.ts`
Expected: FAIL - Module not found: '../../storage/sqliteAdapter.js'

- [ ] **Step 3: Implement createSqliteStorage function**

Create: `src/storage/sqliteAdapter.ts`

```typescript
import type Database from 'better-sqlite3';

export interface StorageAdapter<T> {
  read: (key: string) => T | undefined;
  write: (key: string, value: T) => void;
  delete: (key: string) => void;
}

export const createSqliteStorage = <T>(db: Database.Database): StorageAdapter<T> => {
  // Create sessions table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  return {
    read: (key: string): T | undefined => {
      const row = db.prepare('SELECT value FROM sessions WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
      return row ? JSON.parse(row.value) : undefined;
    },

    write: (key: string, value: T): void => {
      db.prepare('INSERT OR REPLACE INTO sessions (key, value) VALUES (?, ?)').run(
        key,
        JSON.stringify(value)
      );
    },

    delete: (key: string): void => {
      db.prepare('DELETE FROM sessions WHERE key = ?').run(key);
    },
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/storage/sqliteAdapter.test.ts`
Expected: PASS - All tests pass

- [ ] **Step 5: Write test for read operation**

Add to `src/__tests__/storage/sqliteAdapter.test.ts`:

```typescript
  describe('read', () => {
    it('should return undefined for non-existent key', () => {
      const storage = createSqliteStorage(db);

      const result = storage.read('non-existent');

      expect(result).toBeUndefined();
    });

    it('should return stored value for existing key', () => {
      const storage = createSqliteStorage(db);
      const testData = { foo: 'bar', count: 42 };

      db.prepare('INSERT INTO sessions (key, value) VALUES (?, ?)').run(
        'test-key',
        JSON.stringify(testData)
      );

      const result = storage.read('test-key');

      expect(result).toEqual(testData);
    });
  });
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test src/__tests__/storage/sqliteAdapter.test.ts`
Expected: PASS - All tests pass

- [ ] **Step 7: Write test for write operation**

Add to `src/__tests__/storage/sqliteAdapter.test.ts`:

```typescript
  describe('write', () => {
    it('should store value for new key', () => {
      const storage = createSqliteStorage(db);
      const testData = { language: 'en' };

      storage.write('user-123', testData);

      const row = db.prepare('SELECT value FROM sessions WHERE key = ?').get('user-123') as {
        value: string;
      };
      expect(JSON.parse(row.value)).toEqual(testData);
    });

    it('should replace value for existing key', () => {
      const storage = createSqliteStorage(db);

      storage.write('user-123', { language: 'en' });
      storage.write('user-123', { language: 'pt' });

      const row = db.prepare('SELECT value FROM sessions WHERE key = ?').get('user-123') as {
        value: string;
      };
      expect(JSON.parse(row.value)).toEqual({ language: 'pt' });
    });
  });
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm test src/__tests__/storage/sqliteAdapter.test.ts`
Expected: PASS - All tests pass

- [ ] **Step 9: Write test for delete operation**

Add to `src/__tests__/storage/sqliteAdapter.test.ts`:

```typescript
  describe('delete', () => {
    it('should delete existing key', () => {
      const storage = createSqliteStorage(db);

      storage.write('user-123', { language: 'en' });
      storage.delete('user-123');

      const result = storage.read('user-123');
      expect(result).toBeUndefined();
    });

    it('should not throw when deleting non-existent key', () => {
      const storage = createSqliteStorage(db);

      expect(() => storage.delete('non-existent')).not.toThrow();
    });
  });
```

- [ ] **Step 10: Run test to verify it passes**

Run: `pnpm test src/__tests__/storage/sqliteAdapter.test.ts`
Expected: PASS - All tests pass

- [ ] **Step 11: Commit changes**

```bash
git add src/storage/sqliteAdapter.ts src/__tests__/storage/sqliteAdapter.test.ts
git commit -m "feat: implement SQLite storage adapter for sessions"
```

---

## Task 4: Update i18n localeNegotiator

**Files:**
- Modify: `src/config/i18n.ts:5-18`
- Create: `src/__tests__/config/i18n.test.ts`

- [ ] **Step 1: Write failing test for localeNegotiator priority**

Create: `src/__tests__/config/i18n.test.ts`

```typescript
import { i18n } from '../../config/i18n.js';
import type { BotContext } from '../../types/types.js';

describe('i18n Configuration', () => {
  describe('localeNegotiator', () => {
    it('should prioritize session preferredLanguage over Telegram language_code', () => {
      const mockCtx = {
        session: { preferredLanguage: 'pt' as const },
        from: { language_code: 'en' },
      } as unknown as BotContext;

      const negotiator = (i18n as any).config.localeNegotiator;
      const result = negotiator(mockCtx);

      expect(result).toBe('pt');
    });

    it('should use Telegram language_code when no session preference', () => {
      const mockCtx = {
        session: {},
        from: { language_code: 'pt-BR' },
      } as unknown as BotContext;

      const negotiator = (i18n as any).config.localeNegotiator;
      const result = negotiator(mockCtx);

      expect(result).toBe('pt');
    });

    it('should default to en when no preference and unsupported language_code', () => {
      const mockCtx = {
        session: {},
        from: { language_code: 'es' },
      } as unknown as BotContext;

      const negotiator = (i18n as any).config.localeNegotiator;
      const result = negotiator(mockCtx);

      expect(result).toBe('en');
    });

    it('should default to en when no preference and no language_code', () => {
      const mockCtx = {
        session: {},
        from: {},
      } as unknown as BotContext;

      const negotiator = (i18n as any).config.localeNegotiator;
      const result = negotiator(mockCtx);

      expect(result).toBe('en');
    });

    it('should prefer session preferredLanguage en over pt language_code', () => {
      const mockCtx = {
        session: { preferredLanguage: 'en' as const },
        from: { language_code: 'pt' },
      } as unknown as BotContext;

      const negotiator = (i18n as any).config.localeNegotiator;
      const result = negotiator(mockCtx);

      expect(result).toBe('en');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/config/i18n.test.ts`
Expected: FAIL - Tests fail because localeNegotiator doesn't check session

- [ ] **Step 3: Update localeNegotiator to check session first**

Modify `src/config/i18n.ts:5-18`:

```typescript
export const i18n = new I18n<BotContext>({
  defaultLocale: 'en',
  directory: 'src/locales',
  useSession: true,
  localeNegotiator: (ctx) => {
    // Priority 1: User's manual preference (from session)
    if (ctx.session?.preferredLanguage) {
      return ctx.session.preferredLanguage;
    }

    // Priority 2: Auto-detect from Telegram (existing logic)
    const userLang = ctx.from?.language_code;
    if (userLang?.startsWith('pt')) return 'pt';

    // Priority 3: Default to English
    return 'en';
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/config/i18n.test.ts`
Expected: PASS - All tests pass

- [ ] **Step 5: Commit changes**

```bash
git add src/config/i18n.ts src/__tests__/config/i18n.test.ts
git commit -m "feat: update i18n localeNegotiator to prioritize session preference"
```

---

## Task 5: Add Translation Keys

**Files:**
- Modify: `src/locales/en.ftl`
- Modify: `src/locales/pt.ftl`

- [ ] **Step 1: Add English translation keys**

Add to end of `src/locales/en.ftl`:

```ftl
# Language selection
language-selection-prompt = Choose your language:

language-changed = Language changed to English ✅
```

- [ ] **Step 2: Add Portuguese translation keys**

Add to end of `src/locales/pt.ftl`:

```ftl
# Language selection
language-selection-prompt = Escolha o seu idioma:

language-changed = Idioma alterado para Português ✅
```

- [ ] **Step 3: Verify translations load correctly**

Run: `pnpm build`
Expected: Build succeeds, locales copied to dist/

- [ ] **Step 4: Commit changes**

```bash
git add src/locales/en.ftl src/locales/pt.ftl
git commit -m "feat: add language selection translation keys"
```

---

## Task 6: Implement Language Command

**Files:**
- Create: `src/botsCommands/languageCommand.ts`
- Create: `src/__tests__/botsCommands/languageCommand.test.ts`

- [ ] **Step 1: Write failing test for language command**

Create: `src/__tests__/botsCommands/languageCommand.test.ts`

```typescript
import { Bot } from 'grammy';
import type { BotContext } from '../../types/types.js';
import { registerLanguageCommand } from '../../botsCommands/languageCommand.js';

describe('Language Command', () => {
  let bot: Bot<BotContext>;
  let mockCtx: any;

  beforeEach(() => {
    bot = new Bot<BotContext>('fake-token');
    mockCtx = {
      reply: jest.fn(),
      t: jest.fn((key: string) => key),
      session: {},
    };
  });

  describe('registerLanguageCommand', () => {
    it('should register language command handler', () => {
      registerLanguageCommand(bot);

      // Verify command was registered
      expect(bot).toBeDefined();
    });

    it('should show inline keyboard with language options', async () => {
      registerLanguageCommand(bot);

      // Simulate command
      const commandHandler = (bot as any).middleware[0].middleware[0];
      await commandHandler(mockCtx, () => Promise.resolve());

      expect(mockCtx.reply).toHaveBeenCalledWith('language-selection-prompt', {
        reply_markup: expect.objectContaining({
          inline_keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: '🇬🇧 English' }),
              expect.objectContaining({ text: '🇵🇹 Português' }),
            ]),
          ]),
        }),
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/botsCommands/languageCommand.test.ts`
Expected: FAIL - Module not found: '../../botsCommands/languageCommand.js'

- [ ] **Step 3: Implement registerLanguageCommand function**

Create: `src/botsCommands/languageCommand.ts`

```typescript
import { InlineKeyboard } from 'grammy';
import type { Bot } from 'grammy';
import type { BotContext } from '../types/types.js';

export const registerLanguageCommand = (bot: Bot<BotContext>) => {
  bot.command('language', async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text('🇬🇧 English', 'lang:en')
      .text('🇵🇹 Português', 'lang:pt');

    await ctx.reply(ctx.t('language-selection-prompt'), {
      reply_markup: keyboard,
    });
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/botsCommands/languageCommand.test.ts`
Expected: PASS - All tests pass

- [ ] **Step 5: Commit changes**

```bash
git add src/botsCommands/languageCommand.ts src/__tests__/botsCommands/languageCommand.test.ts
git commit -m "feat: implement language command with inline keyboard"
```

---

## Task 7: Implement Language Callback Handler

**Files:**
- Modify: `src/botsCommands/languageCommand.ts`
- Modify: `src/__tests__/botsCommands/languageCommand.test.ts`

- [ ] **Step 1: Write failing test for callback handler**

Add to `src/__tests__/botsCommands/languageCommand.test.ts`:

```typescript
import { registerLanguageCallbacks } from '../../botsCommands/languageCommand.js';

describe('Language Callbacks', () => {
  let bot: Bot<BotContext>;
  let mockCtx: any;

  beforeEach(() => {
    bot = new Bot<BotContext>('fake-token');
    mockCtx = {
      callbackQuery: { data: 'lang:en' },
      session: {},
      i18n: { locale: '' },
      answerCallbackQuery: jest.fn(),
      editMessageText: jest.fn(),
      t: jest.fn((key: string) => key),
    };
  });

  describe('registerLanguageCallbacks', () => {
    it('should update session with selected language', async () => {
      registerLanguageCallbacks(bot);

      mockCtx.callbackQuery.data = 'lang:pt';

      const callbackHandler = (bot as any).middleware[0].middleware[0];
      await callbackHandler(mockCtx, () => Promise.resolve());

      expect(mockCtx.session.preferredLanguage).toBe('pt');
    });

    it('should update i18n locale immediately', async () => {
      registerLanguageCallbacks(bot);

      mockCtx.callbackQuery.data = 'lang:en';

      const callbackHandler = (bot as any).middleware[0].middleware[0];
      await callbackHandler(mockCtx, () => Promise.resolve());

      expect(mockCtx.i18n.locale).toBe('en');
    });

    it('should show confirmation message in selected language', async () => {
      registerLanguageCallbacks(bot);

      mockCtx.callbackQuery.data = 'lang:pt';

      const callbackHandler = (bot as any).middleware[0].middleware[0];
      await callbackHandler(mockCtx, () => Promise.resolve());

      expect(mockCtx.editMessageText).toHaveBeenCalledWith('language-changed');
    });

    it('should answer callback query', async () => {
      registerLanguageCallbacks(bot);

      const callbackHandler = (bot as any).middleware[0].middleware[0];
      await callbackHandler(mockCtx, () => Promise.resolve());

      expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
    });

    it('should handle invalid language code', async () => {
      registerLanguageCallbacks(bot);

      mockCtx.callbackQuery.data = 'lang:es';
      mockCtx.answerCallbackQuery = jest.fn();

      const callbackHandler = (bot as any).middleware[0].middleware[0];
      await callbackHandler(mockCtx, () => Promise.resolve());

      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith({
        text: 'Invalid language selection',
        show_alert: true,
      });
      expect(mockCtx.session.preferredLanguage).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/botsCommands/languageCommand.test.ts`
Expected: FAIL - registerLanguageCallbacks is not exported

- [ ] **Step 3: Implement registerLanguageCallbacks function**

Add to `src/botsCommands/languageCommand.ts`:

```typescript
export const registerLanguageCallbacks = (bot: Bot<BotContext>) => {
  bot.callbackQuery(/^lang:/, async (ctx) => {
    const selectedLang = ctx.callbackQuery.data.split(':')[1];

    // Validate language selection
    if (selectedLang !== 'en' && selectedLang !== 'pt') {
      await ctx.answerCallbackQuery({
        text: 'Invalid language selection',
        show_alert: true,
      });
      return;
    }

    // Update session with type-safe value
    ctx.session.preferredLanguage = selectedLang as 'en' | 'pt';

    // Update i18n locale for immediate effect
    ctx.i18n.locale = selectedLang;

    // Confirm in the newly selected language
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ctx.t('language-changed'));
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/botsCommands/languageCommand.test.ts`
Expected: PASS - All tests pass

- [ ] **Step 5: Commit changes**

```bash
git add src/botsCommands/languageCommand.ts src/__tests__/botsCommands/languageCommand.test.ts
git commit -m "feat: implement language selection callback handler"
```

---

## Task 8: Integrate SQLite Storage and Language Command in Main Bot

**Files:**
- Modify: `src/bots/mainBot.ts:1-62`

- [ ] **Step 1: Write failing integration test**

Create: `src/__tests__/bots/mainBot.integration.test.ts`

```typescript
import { createBot } from '../../bots/mainBot.js';
import fs from 'fs';

describe('Main Bot Integration', () => {
  const testDbPath = 'test-sessions.db';

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should initialize with SQLite storage', async () => {
    // This test verifies the bot starts without errors
    // and creates the database file

    // Note: We can't fully test this without running the bot,
    // but we can verify the structure is correct
    expect(createBot).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `pnpm test src/__tests__/bots/mainBot.integration.test.ts`
Expected: PASS - Basic test passes

- [ ] **Step 3: Import SQLite storage and language commands**

Add imports to top of `src/bots/mainBot.ts`:

```typescript
import Database from 'better-sqlite3';
import { createSqliteStorage } from '../storage/sqliteAdapter.js';
import { registerLanguageCommand, registerLanguageCallbacks } from '../botsCommands/languageCommand.js';
```

- [ ] **Step 4: Initialize SQLite storage with error handling**

Replace the session initialization in `src/bots/mainBot.ts` (around line 41-46):

```typescript
  // Initialize session storage
  function initial(): SessionData {
    return { expenseData: undefined };
  }

  let storage;
  try {
    const db = new Database('sessions.db');
    storage = createSqliteStorage<SessionData>(db);
    logger.info('✅ SQLite session storage initialized');
  } catch (error) {
    logger.error({ error }, '❌ Failed to initialize SQLite, using in-memory sessions');
    storage = undefined; // grammY will use in-memory
  }

  bot.use(session({ initial, storage }));
```

- [ ] **Step 5: Register language command and callbacks**

Add after session middleware (around line 49):

```typescript
  // Enable i18n (must come after session when useSession: true, and before conversations)
  bot.use(i18n.middleware());

  // Register language command and callbacks
  registerLanguageCommand(bot);
  registerLanguageCallbacks(bot);

  // Install the conversations plugin
  bot.use(conversations());
```

- [ ] **Step 6: Build and verify no TypeScript errors**

Run: `pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 7: Run all tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 8: Commit changes**

```bash
git add src/bots/mainBot.ts src/__tests__/bots/mainBot.integration.test.ts
git commit -m "feat: integrate SQLite storage and language command in main bot"
```

---

## Task 9: Manual Testing

**Files:**
- None (manual testing only)

- [ ] **Step 1: Start the bot in development mode**

Run: `pnpm dev`
Expected: Bot starts, logs show "✅ SQLite session storage initialized"

- [ ] **Step 2: Verify sessions.db file is created**

Run: `ls -la sessions.db`
Expected: File exists

- [ ] **Step 3: Test /language command as new user**

1. Open Telegram
2. Send `/language` to the bot
3. Expected: Message "Choose your language:" with buttons 🇬🇧 English | 🇵🇹 Português

- [ ] **Step 4: Test selecting English**

1. Click 🇬🇧 English button
2. Expected: Message changes to "Language changed to English ✅"

- [ ] **Step 5: Verify language persists in expense conversation**

1. Send `/expense`
2. Expected: All prompts are in English
3. Complete or cancel the conversation

- [ ] **Step 6: Test switching to Portuguese**

1. Send `/language`
2. Click 🇵🇹 Português button
3. Expected: Message changes to "Idioma alterado para Português ✅"

- [ ] **Step 7: Verify Portuguese in expense conversation**

1. Send `/expense`
2. Expected: All prompts are in Portuguese

- [ ] **Step 8: Test persistence across bot restart**

1. Stop the bot (Ctrl+C)
2. Start the bot again: `pnpm dev`
3. Send any message to trigger session load
4. Send `/expense`
5. Expected: Still in Portuguese (preference persisted)

- [ ] **Step 9: Inspect database contents**

Run: `sqlite3 sessions.db "SELECT * FROM sessions"`
Expected: See JSON data with preferredLanguage field

- [ ] **Step 10: Test with new user (auto-detect)**

1. Use different Telegram account or clear session
2. Send any command (don't set language preference)
3. Expected: Language auto-detected from Telegram settings

- [ ] **Step 11: Document manual testing results**

Create: `docs/manual-testing-2026-04-29.md`

```markdown
# Manual Testing Results - Language Selection Feature

**Date:** 2026-04-29
**Tester:** [Your Name]

## Test Results

- [ ] Bot starts with SQLite storage
- [ ] sessions.db file created
- [ ] /language command shows keyboard
- [ ] English selection works
- [ ] English persists in /expense
- [ ] Portuguese selection works
- [ ] Portuguese persists in /expense
- [ ] Preference persists across restart
- [ ] Database contains correct data
- [ ] Auto-detect works for new users

## Issues Found

[List any issues encountered]

## Notes

[Any additional observations]
```

- [ ] **Step 12: Commit manual testing documentation**

```bash
git add docs/manual-testing-2026-04-29.md
git commit -m "docs: add manual testing results for language selection"
```

---

## Task 10: Final Integration and Cleanup

**Files:**
- Modify: `src/utils/utils.ts` (if needed for command registration)

- [ ] **Step 1: Verify language command appears in command list**

Update `src/utils/utils.ts` to include language command in the commands list:

Add to the commands array:
```typescript
{
  command: 'language',
  description: 'Choose your language / Escolha o seu idioma',
},
```

- [ ] **Step 2: Set bot commands**

Run the bot and verify: `pnpm dev`
Check Telegram command list in bot UI

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 4: Run linter**

Run: `pnpm lint`
Expected: No linting errors

- [ ] **Step 5: Fix any linting issues**

Run: `pnpm lint:fix`
Expected: Issues auto-fixed

- [ ] **Step 6: Run format check**

Run: `pnpm format:check`
Expected: All files formatted correctly

- [ ] **Step 7: Build for production**

Run: `pnpm build`
Expected: Build succeeds, dist/ contains all files

- [ ] **Step 8: Verify locales copied to dist**

Run: `ls -la dist/locales/`
Expected: en.ftl and pt.ftl present

- [ ] **Step 9: Final commit**

```bash
git add src/utils/utils.ts
git commit -m "feat: add language command to bot command list"
```

- [ ] **Step 10: Create summary commit**

```bash
git log --oneline -10 > /tmp/commits.txt
```

Review commits and create a summary of all changes made.

---

## Verification Checklist

After completing all tasks:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Bot starts successfully with SQLite storage
- [ ] sessions.db file is created
- [ ] sessions.db is in .gitignore
- [ ] /language command is registered
- [ ] Language selection works for both EN and PT
- [ ] Invalid language codes are handled gracefully
- [ ] Preference persists across bot restarts
- [ ] Auto-detection works for users without preference
- [ ] Session preference overrides auto-detection
- [ ] Confirmation message appears in selected language
- [ ] Translation keys exist in both language files
- [ ] Manual testing completed and documented

---

## Post-Implementation Notes

**Database Backup (Optional):**
For production, consider periodic backups of sessions.db:
```bash
sqlite3 sessions.db ".backup sessions-backup-$(date +%Y%m%d).db"
```

**Monitoring:**
Watch logs for:
- "✅ SQLite session storage initialized" (success)
- "❌ Failed to initialize SQLite" (fallback to in-memory)
- Invalid language selection attempts

**Future Enhancements:**
- Add more languages
- Add "Reset to auto-detect" option
- Migrate to PostgreSQL if scaling beyond 100+ users
- Add language selection analytics
