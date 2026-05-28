# Translations Expansion Design

**Date:** 2026-05-28
**Branch:** `add-missing-translations`

## Goal

Expand i18n coverage to all user-facing strings in the bot, and change the default locale from English to Portuguese. Admin-only messages stay in English (system messages, no translation needed).

## Supported Languages

- English (`en`)
- Portuguese / European Portuguese (`pt`) — informal "tu" form

## Section 1: Configuration

**File:** `src/config/i18n.ts`

- Extract a `DEFAULT_LOCALE = 'pt'` constant.
- Replace `defaultLocale: 'en'` with `DEFAULT_LOCALE`.
- Replace the two hardcoded `'en'` fallbacks in the cache functions with `DEFAULT_LOCALE`.

This gives a single knob to flip the bot's default language.

## Section 2: New FTL Keys

Keys added to both `src/locales/en.ftl` and `src/locales/pt.ftl`, grouped by origin.

### From `generalCommands.ts`

| Key | EN | PT |
|-----|----|----|
| `general-lineup-select-day` | Please select the day | Seleciona o dia |
| `general-unknown-error` | Unknown error, please try again later | Erro desconhecido, tenta novamente mais tarde |
| `general-expense-private-only` | ℹ️ Please use the /expense command in a private chat with me: https://t.me/{$username} | ℹ️ Por favor usa o comando /expense numa conversa privada comigo: https://t.me/{$username} |
| `general-about` | This bot allows you to see the schedule for the PDC festival. Use /help to see more. | Este bot permite-te ver o alinhamento do festival PDC. Usa /help para ver mais. |

Note: `general-no-spreadsheet` reuses the existing `expense-no-spreadsheet` key — no new key needed.

### From `languageCommand.ts`

| Key | EN | PT |
|-----|----|----|
| `language-error` | An error occurred while changing language. Please try again. | Ocorreu um erro ao mudar o idioma. Tenta novamente. |
| `language-error-answer` | Error changing language | Erro ao mudar idioma |

### From `utils.ts`

| Key | Variables | Notes |
|-----|-----------|-------|
| `daily-greeting` | `{$date}`, `{$weatherLink}`, `{$minTemp}`, `{$maxTemp}`, `{$dayPhrase}`, `{$dayHasPrecipitation}`, `{$nightPhrase}`, `{$nightHasPrecipitation}` | Full morning message. Weather phrases come from AccuWeather in English for now; will be updated when provider is replaced. |
| `lineup-header` | `{$day}` | "Line-up for {$day}" header in the lineup reply |
| `info-useful-links` | `{$albumUrl}`, `{$spreadsheetId}` | The `/info` command reply with Google Photos and Spreadsheet links |

## Section 3: Source File Changes

### `src/config/i18n.ts`
- Add `export const DEFAULT_LOCALE = 'pt' as const`
- Use it for `defaultLocale` and the two cache fallbacks

### `src/botsCommands/generalCommands.ts`
- Line 14: Day keyboard date formatting `'en-GB'` → `'pt-PT'`
- Line 23: `'Please select the day'` → `ctx.t('general-lineup-select-day')`
- Line 42: `'Unknow error...'` → `ctx.t('general-unknown-error')` (fixes typo)
- Line 115: `/about` reply → `ctx.t('general-about')`
- Line 122: `'Google Spreadsheet ID...'` → `ctx.t('expense-no-spreadsheet')` (reuse existing key)
- Lines 131-133: Private chat redirect → `ctx.t('general-expense-private-only', { username: me.username })`

### `src/botsCommands/languageCommand.ts`
- Line 50: Error reply → `ctx.t('language-error')`
- Line 52: Callback answer → `ctx.t('language-error-answer')`

### `src/utils/utils.ts`
- `getDailyMessageText`: add `locale` parameter; replace template literal with `i18n.translate(locale, 'daily-greeting', vars)`. Callers pass `DEFAULT_LOCALE`.
- `getLineup`: add `locale` parameter; replace header template literal with `i18n.translate(locale, 'lineup-header', { day })`; change date formatting from `'en-GB'` to `'pt-PT'`.
- `getInfoMessage`: replace hardcoded reply with `ctx.t('info-useful-links', { albumUrl: process.env.ALBUM_URL, spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID })`.

## Out of Scope

- Admin commands (`adminCommands.ts`) — stay in English as system messages.
- AccuWeather language parameter — weather provider migration is a separate task.
- Any new language beyond `en` and `pt`.
