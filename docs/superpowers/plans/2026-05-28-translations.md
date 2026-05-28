# Translations Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand i18n coverage to all user-facing strings and set Portuguese as the default locale.

**Architecture:** Add a `DEFAULT_LOCALE` constant to `src/config/i18n.ts` and use it for both the I18n config and the locale cache fallback. Add new FTL keys to both locale files. Update source files to call `ctx.t()` or `i18n.translate(DEFAULT_LOCALE, key, vars)` instead of hardcoded strings. Add a `locale` parameter to `getDailyMessageText` and `getLineup` in `utils.ts`.

**Tech Stack:** TypeScript, grammY, `@grammyjs/i18n`, FTL (Fluent) locale format, Jest with `jest.unstable_mockModule`.

---

## Task 1: Add DEFAULT_LOCALE constant to i18n config

**Files:**
- Modify: `src/config/i18n.ts`
- Modify: `src/__tests__/config/i18n.test.ts`

- [ ] **Step 1: Write failing tests for DEFAULT_LOCALE export and updated cache fallback**

Add these tests to the bottom of the `describe('i18n Configuration', ...)` block in `src/__tests__/config/i18n.test.ts`:

```typescript
import { i18n, DEFAULT_LOCALE, getUserLocaleFromCache } from '../../config/i18n.js';
```

Replace the existing import at line 1 with the above, then add a new describe block after the existing `localeNegotiator` describe:

```typescript
  describe('DEFAULT_LOCALE', () => {
    it('should export DEFAULT_LOCALE as pt', () => {
      expect(DEFAULT_LOCALE).toBe('pt');
    });
  });

  describe('getUserLocaleFromCache', () => {
    it('should return DEFAULT_LOCALE when userId is undefined', () => {
      expect(getUserLocaleFromCache(undefined)).toBe('pt');
    });

    it('should return DEFAULT_LOCALE when user not in cache', () => {
      expect(getUserLocaleFromCache(99999)).toBe('pt');
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="config/i18n"
```

Expected: FAIL — `DEFAULT_LOCALE` is not exported, `getUserLocaleFromCache(undefined)` returns `'en'`.

- [ ] **Step 3: Update `src/config/i18n.ts`**

Replace the full file content:

```typescript
import { I18n } from '@grammyjs/i18n';
import type { BotContext } from '../types/types.js';

export const DEFAULT_LOCALE = 'pt' as const;

// Locale cache for conversation access (workaround for session access issues in conversations)
const userLocaleCache = new Map<number, 'en' | 'pt'>();

export const setUserLocaleCache = (userId: number, locale: 'en' | 'pt') => {
  userLocaleCache.set(userId, locale);
};

export const getUserLocaleFromCache = (userId: number | undefined): 'en' | 'pt' => {
  if (!userId) return DEFAULT_LOCALE;

  return userLocaleCache.get(userId) || DEFAULT_LOCALE;
};

// Configure i18n instance (exported for direct use in conversations)
export const i18n = new I18n<BotContext>({
  defaultLocale: DEFAULT_LOCALE,
  directory: 'src/locales',
  useSession: true,
  localeNegotiator: (ctx) => {
    // Priority 1: User's manual preference (from session)
    if (ctx.session?.preferredLanguage) {
      // Update cache for conversation access
      if (ctx.from?.id) {
        setUserLocaleCache(ctx.from.id, ctx.session.preferredLanguage);
      }

      return ctx.session.preferredLanguage;
    }

    // Priority 2: Auto-detect from Telegram (existing logic)
    const userLang = ctx.from?.language_code;
    const locale = userLang?.startsWith('pt') ? 'pt' : 'en';

    // Update cache with detected locale
    if (ctx.from?.id) {
      setUserLocaleCache(ctx.from.id, locale);
    }

    return locale;
  },
});

// Helper function to get user's locale
export const getUserLocale = (ctx: BotContext): string => {
  // Priority 1: User's manual preference (from session)
  if (ctx.session?.preferredLanguage) {
    return ctx.session.preferredLanguage;
  }

  // Priority 2: Auto-detect from Telegram
  const userLang = ctx.from?.language_code;

  return userLang?.startsWith('pt') ? 'pt' : 'en';
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="config/i18n"
```

Expected: PASS — `DEFAULT_LOCALE` is `'pt'`, cache fallback returns `'pt'`. The existing negotiator tests (which check `'en'` for unsupported languages) still pass because the negotiator logic is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/config/i18n.ts src/__tests__/config/i18n.test.ts
git commit -m "feat: add DEFAULT_LOCALE constant and set Portuguese as default locale"
```

---

## Task 2: General commands translations

**Files:**
- Modify: `src/locales/en.ftl`
- Modify: `src/locales/pt.ftl`
- Modify: `src/botsCommands/generalCommands.ts`
- Modify: `src/__tests__/botsCommands/generalCommands.test.ts`

- [ ] **Step 1: Update the test mock context and assertions to expect translation keys**

In `src/__tests__/botsCommands/generalCommands.test.ts`, update `createCtx` to add `t`:

```typescript
  const createCtx = (text: string = '') => {
    const message = {
      text,
      video_note: { file_id: 'vn123' },
      photo: [{ file_id: 'p1' }, { file_id: 'p2' }],
      video: { file_id: 'v123', file_name: 'test.mp4' },
    };

    return {
      from: { id: 123 },
      chat: { id: 456, type: 'private' },
      message,
      update: { message },
      reply: jest.fn(),
      answerCallbackQuery: jest.fn().mockResolvedValue(true as never),
      conversation: { enter: jest.fn() },
      match: [text],
      t: jest.fn((key: string) => key),
    };
  };
```

Then update these four assertions:

**Lineup select day** (currently line ~106):
```typescript
    handlers['command:lineup'](ctx);

    expect(ctx.t).toHaveBeenCalledWith('general-lineup-select-day');
    expect(ctx.reply).toHaveBeenCalledWith(
      'general-lineup-select-day',
      expect.objectContaining({ reply_markup: expect.anything() }),
    );
```

**Unknown error** (currently line ~140):
```typescript
      expect(ctx.reply).toHaveBeenCalledWith('general-unknown-error');
```

**About command** (currently lines ~194-197):
```typescript
    handlers['command:about'](ctx);
    expect(ctx.t).toHaveBeenCalledWith('general-about');
    expect(ctx.reply).toHaveBeenCalledWith('general-about');
```

**Expense spreadsheet missing** (currently line ~206):
```typescript
      expect(ctx.reply).toHaveBeenCalledWith('expense-no-spreadsheet');
```

**Expense private-chat redirect** (currently line ~215):
```typescript
      expect(ctx.reply).toHaveBeenCalledWith(
        'general-expense-private-only',
        expect.any(Object),
      );
```

The `getLineup` call assertion (currently line ~124) stays as-is for now — locale is added in Task 4:
```typescript
      expect(getLineup).toHaveBeenCalledWith('2026-08-14');
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="generalCommands"
```

Expected: FAIL — assertions check for key strings but code still uses hardcoded English.

- [ ] **Step 3: Add new keys to `src/locales/en.ftl`**

Append to the end of the file (after `onboarding-no = No`):

```ftl
# General command translations (English)

general-lineup-select-day = Please select the day

general-unknown-error = Unknown error, please try again later

general-expense-private-only = ℹ️ Please use the /expense command in a private chat with me: https://t.me/{$username}

general-about = This bot allows you to see the schedule for the PDC festival. Use /help to see more.
```

- [ ] **Step 4: Add new keys to `src/locales/pt.ftl`**

Append to the end of the file (after `onboarding-no = Não`):

```ftl
# Traduções de comandos gerais (Português)

general-lineup-select-day = Seleciona o dia

general-unknown-error = Erro desconhecido, tenta novamente mais tarde

general-expense-private-only = ℹ️ Por favor usa o comando /expense numa conversa privada comigo: https://t.me/{$username}

general-about = Este bot permite-te ver o alinhamento do festival PDC. Usa /help para ver mais.
```

- [ ] **Step 5: Update `src/botsCommands/generalCommands.ts`**

Replace line 14 (`'en-GB'` locale for day keyboard):
```typescript
      const formattedDay = new Date(day).toLocaleString('pt-PT', {
```

Replace line 23 (lineup reply):
```typescript
    ctx.reply(ctx.t('general-lineup-select-day'), { reply_markup: keyboard });
```

Keep line 34 (getLineup call) unchanged for now — locale parameter is added in Task 4 when getLineup's signature is updated:
```typescript
      await ctx.reply(getLineup(dayStr), {
```

Replace line 42 (unknown error reply):
```typescript
      await ctx.reply(ctx.t('general-unknown-error'));
```

Replace lines 113-117 (`/about` command):
```typescript
  bot.command('about', (ctx) => {
    ctx.reply(ctx.t('general-about'));
  });
```

Replace line 122 (spreadsheet check reply):
```typescript
      ctx.reply(ctx.t('expense-no-spreadsheet'));
```

Replace lines 131-133 (private chat redirect):
```typescript
      ctx.reply(
        ctx.t('general-expense-private-only', { username: me.username! }),
      );
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="generalCommands"
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/locales/en.ftl src/locales/pt.ftl src/botsCommands/generalCommands.ts src/__tests__/botsCommands/generalCommands.test.ts
git commit -m "feat: add general command translations and replace hardcoded strings"
```

---

## Task 3: Language command error translations

**Files:**
- Modify: `src/locales/en.ftl`
- Modify: `src/locales/pt.ftl`
- Modify: `src/botsCommands/languageCommand.ts`
- Modify: `src/__tests__/botsCommands/languageCommand.test.ts`

- [ ] **Step 1: Write failing test for error path**

Add to the `createCtx` function's `t` mock in `src/__tests__/botsCommands/languageCommand.test.ts` — extend the translations map:

```typescript
      const translations: Record<string, string> = {
        'language-selection-prompt': 'Choose your language:',
        'language-changed': 'Language changed to {$language}',
        'language-error': 'An error occurred while changing language. Please try again.',
        'language-error-answer': 'Error changing language',
      };
```

Then add a new test inside the `describe('language callback handler', ...)` block:

```typescript
    it('should handle errors in language selection', async () => {
      const ctx = createCtx();

      // Force i18n.translate to throw
      ctx.match = ['lang:en', 'en'];
      ctx.session.preferredLanguage = undefined as never;

      // Make answerCallbackQuery throw to trigger catch
      ctx.answerCallbackQuery.mockRejectedValueOnce(new Error('API error'));

      const callbackKey = Object.keys(handlers).find(
        (k) => k.startsWith('callbackQuery:') && handlers[k],
      );

      if (callbackKey) {
        await handlers[callbackKey](ctx);

        expect(ctx.t).toHaveBeenCalledWith('language-error');
      }
    });
```

- [ ] **Step 2: Run tests to verify the new test fails**

```bash
npm test -- --testPathPattern="languageCommand"
```

Expected: FAIL on the new test — error path calls hardcoded string, not `ctx.t('language-error')`.

Note: The existing passing tests may still pass since we only added a new test; that's expected.

- [ ] **Step 3: Add new keys to `src/locales/en.ftl`**

Add after `language-changed` (currently line 68):

```ftl
language-error = An error occurred while changing language. Please try again.

language-error-answer = Error changing language
```

- [ ] **Step 4: Add new keys to `src/locales/pt.ftl`**

Add after `language-changed` (currently line 68):

```ftl
language-error = Ocorreu um erro ao mudar o idioma. Tenta novamente.

language-error-answer = Erro ao mudar idioma
```

- [ ] **Step 5: Update `src/botsCommands/languageCommand.ts`**

Replace the catch block (lines 47-53):

```typescript
    } catch (e) {
      logger.error(e);
      await ctx
        .reply(ctx.t('language-error'))
        .catch(() => {});
      await ctx.answerCallbackQuery(ctx.t('language-error-answer')).catch(() => {});
    }
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="languageCommand"
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/locales/en.ftl src/locales/pt.ftl src/botsCommands/languageCommand.ts src/__tests__/botsCommands/languageCommand.test.ts
git commit -m "feat: add language command error translations"
```

---

## Task 4: Utils translations (daily message, lineup header, info links)

**Files:**
- Modify: `src/locales/en.ftl`
- Modify: `src/locales/pt.ftl`
- Modify: `src/utils/utils.ts`
- Modify: `src/botsCommands/generalCommands.ts` (update getLineup call site + add getUserLocale import)
- Modify: `src/__tests__/utils/utils.test.ts`
- Modify: `src/__tests__/botsCommands/generalCommands.test.ts` (update getLineup assertion to include locale)

- [ ] **Step 1: Add i18n mock to `src/__tests__/utils/utils.test.ts`**

Add a module mock for i18n **before** the existing mocks (insert after line 1 `import { jest... }`):

```typescript
const mockI18nTranslate = jest.fn((locale: string, key: string) => `[${locale}:${key}]`);

jest.unstable_mockModule('../../config/i18n.js', () => ({
  i18n: { translate: mockI18nTranslate },
  DEFAULT_LOCALE: 'pt',
  getUserLocale: jest.fn(() => 'pt'),
  getUserLocaleFromCache: jest.fn(() => 'pt'),
  setUserLocaleCache: jest.fn(),
}));
```

Also add `mockI18nTranslate` to the `beforeEach` clear:
```typescript
  beforeEach(() => {
    jest.clearAllMocks();
    mockI18nTranslate.mockImplementation((locale: string, key: string) => `[${locale}:${key}]`);
  });
```

- [ ] **Step 2: Update the `getDailyMessageText` tests**

Replace the two existing tests inside `describe('getDailyMessageText', ...)`:

```typescript
  describe('getDailyMessageText', () => {
    it('should call i18n.translate with correct weather variables', () => {
      const mockWeather = {
        MobileLink: 'http://test.link',
        Temperature: {
          Minimum: { Value: 15, Unit: 'C', UnitType: 17 },
          Maximum: { Value: 25, Unit: 'C', UnitType: 17 },
        },
        Day: { IconPhrase: 'Sunny', HasPrecipitation: false },
        Night: { IconPhrase: 'Clear', HasPrecipitation: false },
      } as unknown as Forecast;

      getDailyMessageText(mockWeather, '2026-01-01', 'pt');

      expect(mockI18nTranslate).toHaveBeenCalledWith(
        'pt',
        'daily-greeting',
        expect.objectContaining({
          weatherLink: 'http://test.link',
          minTemp: 15,
          maxTemp: 25,
          dayPhrase: 'sunny',
          dayHasPrecipitation: 'no',
          nightPhrase: 'clear',
          nightHasPrecipitation: 'no',
        }),
      );
    });

    it('should pass "yes" for dayHasPrecipitation when it rains', () => {
      const mockWeather = {
        MobileLink: 'http://test.link',
        Temperature: {
          Minimum: { Value: 10, Unit: 'C', UnitType: 17 },
          Maximum: { Value: 20, Unit: 'C', UnitType: 17 },
        },
        Day: { IconPhrase: 'Rainy', HasPrecipitation: true },
        Night: { IconPhrase: 'Stormy', HasPrecipitation: true },
      } as unknown as Forecast;

      getDailyMessageText(mockWeather, '2026-01-02', 'en');

      expect(mockI18nTranslate).toHaveBeenCalledWith(
        'en',
        'daily-greeting',
        expect.objectContaining({
          dayHasPrecipitation: 'yes',
          nightHasPrecipitation: 'yes',
        }),
      );
    });
  });
```

- [ ] **Step 3: Update the `getLineup` test**

Update the lineup test to pass locale and check the header translation call:

```typescript
  describe('getDays & getLineup', () => {
    it('should return festival days', () => {
      mockGetFestivalData.mockReturnValue({ '2026-08-14': [], '2026-08-15': [] });
      expect(getDays()).toEqual(['2026-08-14', '2026-08-15']);
    });

    it('should call i18n.translate for lineup header and include concert data', () => {
      mockGetFestivalData.mockReturnValue({
        '2026-08-14': [
          { hour: '20:00', name: 'Band A', stage: 'Main Stage', url: 'http://banda.com', day: 14 },
        ],
      });
      const lineup = getLineup('2026-08-14', 'pt');

      expect(mockI18nTranslate).toHaveBeenCalledWith('pt', 'lineup-header', expect.objectContaining({ day: expect.any(String) }));
      expect(lineup).toContain('Band A');
      expect(lineup).toContain('20:00');
      expect(lineup).toContain('Main Stage');
    });

    it('should return empty string for unknown day', () => {
      mockGetFestivalData.mockReturnValue({});
      expect(getLineup('2026-08-15', 'pt')).toBe('');
    });
  });
```

- [ ] **Step 4: Update the `getInfoMessage` test**

Replace the existing `getInfoMessage` test:

```typescript
  describe('getInfoMessage', () => {
    it('should call ctx.t with info-useful-links key', () => {
      process.env.ALBUM_URL = 'http://album';
      process.env.GOOGLE_SPREADSHEET_ID = 'test-sheet';
      const mockCtx = {
        reply: jest.fn().mockResolvedValue(true as never),
        from: { id: 999 },
        t: jest.fn((key: string) => `translated:${key}`),
      } as unknown as BotContext;

      getInfoMessage(mockCtx);

      expect(mockCtx.t).toHaveBeenCalledWith(
        'info-useful-links',
        expect.objectContaining({
          albumUrl: 'http://album',
          spreadsheetUrl: expect.stringContaining('test-sheet'),
        }),
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        'translated:info-useful-links',
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
    });
  });
```

- [ ] **Step 5: Update the `generateDailyMessage` test**

Update the existing generateDailyMessage test assertion (it checks for `'temperature in Paredes de Coura'` which will now be inside the FTL key). Replace the `sendMessage` assertion:

```typescript
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        555,
        expect.stringContaining('[pt:daily-greeting]'),
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
```

- [ ] **Step 6: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="utils/utils"
```

Expected: FAIL — `getDailyMessageText` still uses template literal, `getLineup` takes no locale, `getInfoMessage` uses hardcoded string.

- [ ] **Step 7: Add new FTL keys to `src/locales/en.ftl`**

Append after the general command keys added in Task 2:

```ftl
# Utils translations (English)

daily-greeting =
    Hello friends! 👋

    Hope you had a great night.

    Today is {$date}

    The <a href="{$weatherLink}">temperature in Paredes de Coura</a> will range from a low of ↘️ <b>{$minTemp}ºC</b> to a high of <b>{$maxTemp}ºC</b> ↗️

    Expect a {$dayPhrase} <b>{ $dayHasPrecipitation ->
        [yes] with
       *[other] without
    }</b> rain during the day,
    and a {$nightPhrase} <b>{ $nightHasPrecipitation ->
        [yes] with
       *[other] without
    }</b> rain kind of night.

    Wishing you a beautiful day! ❤️

lineup-header = <b>Line-up for {$day}</b>

info-useful-links =
    <b>Useful links:</b>

    📷 Google Photos Album : <a href="{$albumUrl}">🏳️‍🌈 Paredes de Coura 2025</a>

    ℹ️ Pré-Festival Spreadsheet: <a href="{$spreadsheetUrl}">Pré-Festival Paredes de Coura 2025</a>
```

- [ ] **Step 8: Add new FTL keys to `src/locales/pt.ftl`**

Append after the general command keys added in Task 2:

```ftl
# Traduções de utilitários (Português)

daily-greeting =
    Olá amigos! 👋

    Esperamos que tenham tido uma boa noite.

    Hoje é {$date}

    A <a href="{$weatherLink}">temperatura em Paredes de Coura</a> vai variar entre um mínimo de ↘️ <b>{$minTemp}ºC</b> e um máximo de <b>{$maxTemp}ºC</b> ↗️

    Esperem um {$dayPhrase} <b>{ $dayHasPrecipitation ->
        [yes] com
       *[other] sem
    }</b> chuva durante o dia,
    e uma noite {$nightPhrase} <b>{ $nightHasPrecipitation ->
        [yes] com
       *[other] sem
    }</b> chuva.

    Tenham um lindo dia! ❤️

lineup-header = <b>Alinhamento para {$day}</b>

info-useful-links =
    <b>Links úteis:</b>

    📷 Álbum Google Photos : <a href="{$albumUrl}">🏳️‍🌈 Paredes de Coura 2025</a>

    ℹ️ Folha de cálculo Pré-Festival: <a href="{$spreadsheetUrl}">Pré-Festival Paredes de Coura 2025</a>
```

- [ ] **Step 9: Update `src/utils/utils.ts`**

Add import at the top (after existing imports):

```typescript
import { i18n, DEFAULT_LOCALE } from '../config/i18n.js';
```

Replace the `getLineup` function (lines 7-24):

```typescript
export const getLineup = (weekDay: string, locale: 'en' | 'pt'): string => {
  const concertData = getFestivalData();
  const formattedDay = new Date(weekDay).toLocaleString('pt-PT', {
    weekday: 'long',
    day: '2-digit',
  });
  const response = i18n.translate(locale, 'lineup-header', { day: formattedDay });

  if (!(weekDay in concertData)) {
    return '';
  }

  return `${response}\n\n${concertData[weekDay]
    .map(
      (concert) =>
        `<i>${concert.hour}</i>: <b><a href="${concert.url}">${concert.name}</a></b> - ${concert.stage}\n`,
    )
    .join('')}`;
};
```

Replace the `getDailyMessageText` function (lines 28-42):

```typescript
export const getDailyMessageText = (weather: Forecast, day: string, locale: 'en' | 'pt'): string => {
  const formattedDate = new Date(day).toLocaleDateString('pt-PT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return i18n.translate(locale, 'daily-greeting', {
    date: formattedDate,
    weatherLink: weather.MobileLink,
    minTemp: weather.Temperature.Minimum.Value,
    maxTemp: weather.Temperature.Maximum.Value,
    dayPhrase: weather.Day.IconPhrase.toLowerCase(),
    dayHasPrecipitation: weather.Day.HasPrecipitation ? 'yes' : 'no',
    nightPhrase: weather.Night.IconPhrase.toLowerCase(),
    nightHasPrecipitation: weather.Night.HasPrecipitation ? 'yes' : 'no',
  });
};
```

Update the `generateDailyMessage` call to `getDailyMessageText` (line ~72) to pass `DEFAULT_LOCALE`:

```typescript
  const text = getDailyMessageText(weatherData, day, DEFAULT_LOCALE);
```

Update the `getLineup` call inside `generateDailyMessage` (line ~77) to pass `DEFAULT_LOCALE`:

```typescript
  const lineUp = getLineup(day, DEFAULT_LOCALE);
```

Replace the `getInfoMessage` function (lines 105-115):

```typescript
export const getInfoMessage = (ctx: BotContext) => {
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SPREADSHEET_ID}/edit?usp=sharing`;

  ctx
    .reply(
      ctx.t('info-useful-links', {
        albumUrl: process.env.ALBUM_URL ?? '',
        spreadsheetUrl,
      }),
      {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      },
    )
    .then(() => logger.info({ userId: ctx.from?.id }, 'User requested info'));
};
```

- [ ] **Step 10: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="utils/utils"
```

Expected: PASS

- [ ] **Step 10b: Update `getLineup` call site in `src/botsCommands/generalCommands.ts`**

Add import at the top (after existing imports):
```typescript
import { getUserLocale } from '../config/i18n.js';
```

Update the `getLineup` call in the callback handler (the line that was kept as `getLineup(dayStr)` in Task 2):
```typescript
      await ctx.reply(getLineup(dayStr, getUserLocale(ctx) as 'en' | 'pt'), {
```

- [ ] **Step 10c: Update getLineup assertion in `src/__tests__/botsCommands/generalCommands.test.ts`**

Find the test `'should handle lineup callback'` and update the getLineup assertion (previously left as no locale):
```typescript
      expect(getLineup).toHaveBeenCalledWith('2026-08-14', 'en');
```

(The mock ctx has `from: { id: 123 }` with no `language_code`, so `getUserLocale` returns `'en'`.)

- [ ] **Step 11: Run all modified tests**

```bash
npm test -- --testPathPattern="utils/utils|generalCommands"
```

Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add src/locales/en.ftl src/locales/pt.ftl src/utils/utils.ts src/botsCommands/generalCommands.ts src/__tests__/utils/utils.test.ts src/__tests__/botsCommands/generalCommands.test.ts
git commit -m "feat: add daily message, lineup, and info link translations"
```

---

## Task 5: Final verification

**Files:** none changed

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass. Coverage unchanged or improved.

- [ ] **Step 2: Verify build succeeds**

```bash
npm run build
```

Expected: Exits with code 0. The `dist/locales/` directory contains the updated `en.ftl` and `pt.ftl` files.

- [ ] **Step 3: Spot-check the built locale files**

```bash
grep "general-lineup-select-day" dist/locales/en.ftl dist/locales/pt.ftl
grep "daily-greeting" dist/locales/en.ftl dist/locales/pt.ftl
grep "info-useful-links" dist/locales/en.ftl dist/locales/pt.ftl
```

Expected: Each grep returns two lines (one per file).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify build and translations complete"
```

Only commit if there are actual changes (e.g. build artifacts — though these are typically gitignored). If nothing to commit, skip.
