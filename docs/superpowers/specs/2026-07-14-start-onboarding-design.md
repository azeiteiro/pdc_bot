# Connect `/start` to the Onboarding Flow

## Context

The bot currently has an `/onboarding` command that walks a user through a
multi-step registration conversation (name, arrival/departure dates, car
ownership, departure location, additional info, summary, payment
instructions). Separately, `/start` — the command Telegram sends when a user
begins a new conversation with the bot — only replies with a static welcome
message (`onboarding-start-welcome`) and does nothing else.

The goal is for `/start` to act as the natural entry point into onboarding:
new users messaging the bot for the first time should be guided straight into
the onboarding flow, without needing to know about or type `/onboarding`
separately.

## Requirements

- `/start` in a private chat:
  1. Sends the existing welcome message (`onboarding-start-welcome`).
  2. Immediately triggers the same entry logic as `/onboarding` today:
     - Checks the user's `onboarding_status`.
       - `STARTED` → reply with `onboarding-already-started`, stop.
       - `WAITING_PAYMENT` → reply with `onboarding-already-waiting`, stop.
       - `COMPLETED` → reply with `onboarding-already-completed`, stop.
     - Otherwise, creates/updates the user record with status `STARTED` and
       enters the `onboardingConversation`.
- `/start` in a group chat: does nothing (no reply, no side effects), matching
  `/onboarding`'s existing private-chat-only restriction.
- `/onboarding` keeps working exactly as it does today (no welcome message,
  same status checks, same conversation entry). Both commands remain
  available — `/onboarding` is not removed.
- No changes to the onboarding conversation itself, the database schema, the
  Google Sheets integration, or `commands.json`.

## Design

### Architecture

- **`src/botsCommands/onboardingCommands.ts`**: extract the body of the
  current `/onboarding` handler into an exported function:

  ```ts
  export async function startOnboardingFlow(ctx: BotContext): Promise<void>
  ```

  This function contains, unchanged from today's `/onboarding` handler:
  - The private-chat-only guard (`if (ctx.chat?.type !== 'private') return;`)
  - The status checks against `getUserById`
  - `createOrUpdateUser(...)` with `STARTED` status
  - `ctx.conversation.enter('onboardingConversation')`

  The `bot.command('onboarding', ...)` registration becomes a thin wrapper
  that just calls `startOnboardingFlow(ctx)`.

- **`src/bots/mainBot.ts`**: the existing `bot.command('start', ...)` handler
  is updated to:

  ```ts
  telegramBot.command('start', async (ctx) => {
    if (ctx.chat?.type !== 'private') return;

    await ctx.reply(ctx.t('onboarding-start-welcome'));
    await startOnboardingFlow(ctx);
  });
  ```

  `startOnboardingFlow` is imported from `onboardingCommands.ts`.

### Data Flow

**`/start` in a private chat:**
1. Guard passes (private chat).
2. Bot replies with the welcome message.
3. `startOnboardingFlow(ctx)` runs the same status-check / user-creation /
   conversation-entry logic as `/onboarding` today.
4. From there, the flow is identical to the existing onboarding conversation
   (name → arrival date → departure date → car → location → additional info →
   summary → Google Sheets write → payment instructions).

**`/start` in a group chat:**
1. Guard fails → handler returns immediately. No reply, no DB writes, no
   conversation entry.

**`/onboarding` (unchanged behavior, delegated to the shared function):**
1. Same guard + status checks + conversation entry as before, now living in
   `startOnboardingFlow`. No welcome message is sent (that remains exclusive
   to `/start`).

### Error Handling

No new error paths are introduced:

- If `ctx.from?.id` is missing, `startOnboardingFlow` returns silently, same
  as today's `/onboarding`.
- Database errors from `getUserById` / `createOrUpdateUser` propagate to the
  bot's existing global error handler (`telegramBot.catch(...)` in
  `mainBot.ts`), unchanged.
- Conversation failures (e.g. the Google Sheets write failure at the end of
  the flow) are already handled inside `onboardingConversation.ts` and remain
  untouched.
- If sending the welcome message fails, the `await` throws before
  `startOnboardingFlow` runs, and the global error handler catches it,
  consistent with existing error handling elsewhere in the bot.

### Testing

- Update `src/__tests__/botsCommands/onboardingCommands.test.ts` so the
  existing `/onboarding` tests exercise `startOnboardingFlow` (directly or via
  the command wrapper) to confirm behavior is unchanged after the extraction.
- Add tests covering `/start`'s new behavior:
  - Private chat, new user: welcome message is sent, then the user is created
    with `STARTED` status and the conversation is entered.
  - Private chat, existing user with `STARTED` / `WAITING_PAYMENT` /
    `COMPLETED` status: welcome message is sent, then the correct
    "already ..." reply is sent and the conversation is not (re-)entered.
  - Group chat: no reply, no DB writes, conversation not entered.
- No changes needed to `onboardingConversation.test.ts` since the conversation
  itself is untouched.

## Out of Scope

- Changing the wording of `onboarding-start-welcome` or any other onboarding
  message text.
- Adding `/start` to `commands.json` (Telegram surfaces `/start` automatically
  in fresh chats; it's not part of the bot's user-facing command menu).
- Removing or deprecating `/onboarding`.
