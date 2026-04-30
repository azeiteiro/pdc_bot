# Onboarding 2026 - Design Specification

**Created:** 2026-04-30
**Status:** Approved
**Branch:** `feature/onboarding-2026`

## Overview

This feature implements an automated onboarding system for the 2026 music festival. Users will complete a form through the Telegram bot, submit payment information, and receive a single-use invite link to join the festival group after admin payment confirmation.

## Goals

1. Streamline the festival registration process
2. Collect attendee information (arrival/departure dates, car sharing, etc.) in a structured format
3. Manage payment confirmations manually before granting group access
4. Prevent unauthorized group access through single-use invite links
5. Provide admins with visibility into pending registrations

## User Flow

### For Attendees

1. User runs `/start` → Bot directs them to `/onboarding`
2. User runs `/onboarding` → Bot starts conversation to collect:
   - Name (auto-filled from Telegram, confirmation required)
   - Arrival date (optional, supports natural language)
   - Departure date (optional, supports natural language)
   - Car availability (yes/no)
   - Departure location (conditional on car = yes)
   - Additional information (optional)
3. User reviews summary and submits
4. Bot saves data to Google Sheets and shows payment instructions (€50 via MBWay/Revolut)
5. User waits for payment confirmation
6. After admin confirms payment, user receives single-use invite link
7. User joins the 2026 festival group

### For Admins

1. Admin receives notification when user completes onboarding (status: WAITING_PAYMENT)
2. Admin verifies payment manually (MBWay/Revolut)
3. Admin runs `/confirm <user_id>` to approve
4. Bot generates and sends single-use invite link to user
5. Admin can use `/pending` to view all users in STARTED or WAITING_PAYMENT status

## Architecture

### Components

1. **Database Layer**: New `users` table in SQLite for user state and onboarding status tracking
2. **Conversation Handler**: grammY conversation (`onboardingConversation`) with inline keyboard buttons
3. **Commands Module**: New file `src/botsCommands/onboardingCommands.ts`
4. **Google Sheets Integration**: Extend `src/googleApi/googleSheetsApi.ts` with `addOnboardingData()`
5. **Admin Notifications**: Direct message to first admin in `ADMIN_IDS`
6. **Natural Language Dates**: Add `chrono-node` dependency for date parsing

### Data Flow

```
User → /onboarding → Check DB status → Conversation (collect data)
→ Save to Google Sheets → Update DB (WAITING_PAYMENT) → Notify admin
→ Admin /confirm → Generate invite link → Send to user → Update DB (COMPLETED)
```

### Integration Points

**Reuses existing:**
- i18n system (grammY i18n plugin)
- SQLite adapter pattern
- Google Sheets API authentication and patterns
- Admin authorization checks (ADMIN_IDS)
- pino logger for structured logging

**Modifies:**
- `/start` command to include onboarding instructions
- Environment variable `CHAT_ID` renamed to `GROUP_CHAT_ID`

**Adds:**
- New `users` table
- New conversation handler
- New commands: `/onboarding`, `/pending`, `/confirm`, `/cancel`
- New dependency: `chrono-node`

## Database Schema

### New Table: `users`

```sql
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY,
  telegram_username TEXT,
  preferred_language TEXT,
  onboarding_status TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**Fields:**
- `user_id`: Telegram user ID (primary key)
- `telegram_username`: @username for admin reference
- `preferred_language`: 'en' or 'pt' (nullable, for future use)
- `onboarding_status`: null, 'STARTED', 'WAITING_PAYMENT', or 'COMPLETED'
- `created_at`: First interaction timestamp
- `updated_at`: Last status change timestamp

**Operations:**
- `/onboarding`: Insert/update status to 'STARTED'
- After conversation completion: Update to 'WAITING_PAYMENT'
- `/confirm`: Update to 'COMPLETED'
- `/cancel`: DELETE user record
- `/pending`: Query WHERE status IN ('STARTED', 'WAITING_PAYMENT')

### New File

**`src/storage/userRepository.ts`**: CRUD operations for user records

```typescript
export function createOrUpdateUser(db: Database, userId: number, username: string, status: string): void
export function getUserByIdatabase, userId: number): User | undefined
export function deleteUser(db: Database, userId: number): void
export function getPendingUsers(db: Database): User[]
export function updateUserStatus(db: Database, userId: number, status: string): void
```

## Conversation Flow

The conversation uses inline keyboards for improved UX. Built with `@grammyjs/conversations`.

### Step 1: Name Confirmation

**Bot:** "I see your name is **[First Last]** from your Telegram profile. Is this correct?"

**Buttons:**
- `✓ Yes, that's correct`
- `✏️ No, let me type it`

**If "No":** User types their preferred name

### Step 2: Arrival Date

**Bot:** "When do you plan to arrive? (e.g., 'tomorrow', 'next Friday', '15/05/2026', or click 'Don't know')"

**Buttons:**
- `🤷 Don't know yet`

**If user types:** Parse with `chrono-node` in user's language (PT/EN)

**On successful parse:** Confirm with "Got it! **15 May 2026**. Correct?" with ✓/✗ buttons

**On parse failure:** "I couldn't understand that date. Please try again or click 'Don't know'"

**Store:** Formatted date string (DD/MM/YYYY) or translated "Don't know"

### Step 3: Departure Date

Same flow as arrival date.

### Step 4: Car Question

**Bot:** "Will you be traveling by car?"

**Buttons:**
- `🚗 Yes`
- `❌ No`

### Step 5: Departure Location (conditional)

**If car = Yes:**

**Bot:** "Where will you be departing from?"

User types location (free text)

**If car = No:** Skip this step, store empty string

### Step 6: Additional Information

**Bot:** "Any additional information you'd like to share? (Optional)"

**Buttons:**
- `⏭️ Skip`

User can type free text or skip

### Step 7: Summary & Confirmation

**Bot:** Shows formatted summary:
```
Please review your information:

Name: João Silva
Arrival: 15/05/2026
Departure: Don't know yet
Car: Yes
Departing from: Lisbon
Additional info: Vegetarian

Is this correct?
```

**Buttons:**
- `✅ Submit`
- `❌ Cancel`

**If Submit:**
1. Call `addOnboardingData()` to save to Google Sheets
2. Update user status to 'WAITING_PAYMENT'
3. Notify admin
4. Show payment instructions to user

**If Cancel:**
1. Delete user record from database
2. Exit conversation
3. Show cancellation message

## Commands

### User Commands

#### `/start` (Updated)

**Current behavior:** Shows welcome message

**New behavior:** Add onboarding instructions:

```
Welcome! To join the 2026 festival group, please complete the onboarding process using /onboarding
```

#### `/onboarding`

**Trigger:** User wants to start/restart onboarding

**Logic:**
1. Check user's `onboarding_status` in database
2. Route based on status:
   - **No record/null:** Create user with status 'STARTED', enter conversation
   - **'STARTED':** Show "You already started onboarding. Please continue answering the questions, or use /cancel to restart."
   - **'WAITING_PAYMENT':** Show "You already submitted your onboarding! Please wait for payment confirmation."
   - **'COMPLETED':** Show "You're already registered for 2026!"

#### `/cancel`

**Authorization:** Any user (but only effective if status = 'STARTED')

**Logic:**
1. Check user status
2. If 'STARTED':
   - Delete user record from database
   - Exit conversation
   - Show "Onboarding cancelled. You can start again with /onboarding anytime."
3. If other status: Show "Nothing to cancel. Use /onboarding to check your status."

### Admin Commands

All admin commands require user_id to be in `ADMIN_IDS` environment variable.

#### `/pending`

**Authorization:** Admin only

**Logic:**
1. Verify admin authorization
2. Query users WHERE status IN ('STARTED', 'WAITING_PAYMENT')
3. Format and display:

```
Started (2):
- @username1 (ID: 123456)
- @username2 (ID: 789012)

Waiting Payment (3):
- @username3 (ID: 345678)
- @username4 (ID: 901234)
- @username5 (ID: 567890)
```

**If no pending users:** "No pending onboarding submissions."

#### `/confirm <user_id>`

**Authorization:** Admin only

**Parameters:** `user_id` (required, numeric)

**Logic:**
1. Verify admin authorization
2. Parse and validate user_id parameter
3. Check user exists and status = 'WAITING_PAYMENT'
4. Generate single-use invite link:
   ```typescript
   bot.api.createChatInviteLink(GROUP_CHAT_ID, {
     member_limit: 1,
     name: `Invite for @${username}`
   })
   ```
5. Send invite link to user with message
6. Update user status to 'COMPLETED'
7. Confirm to admin: "✅ Invite sent to @username (ID: 123456)"

**Error cases:**
- Invalid format: "Invalid user ID. Please use: /confirm <user_id>"
- User not found: "User ID 123456 not found in database."
- Wrong status: "User @username is not waiting for payment (current status: COMPLETED)"
- Not admin: "You're not authorized to use this command."
- Invite generation fails: "Failed to generate invite link. Please try again or check bot permissions."

## Google Sheets Integration

### New Function: `addOnboardingData()`

**File:** `src/googleApi/googleSheetsApi.ts`

**Parameters:**

```typescript
interface OnboardingData {
  nome: string;              // User's name
  dataChegada: string;       // "15/05/2026" or i18n("onboarding.dont_know")
  dataPartida: string;       // "20/05/2026" or i18n("onboarding.dont_know")
  levaCarro: string;         // i18n("onboarding.yes") or i18n("onboarding.no")
  localPartida: string;      // Location or empty string
  tendaEntregue: "Não";      // Always "Não" by default
  observacoes: string;       // Additional info or empty string
}
```

**Implementation:**
1. Use existing Google Sheets API client and authentication
2. Append row to sheet specified by `ONBOARDING_SHEET_ID` environment variable
3. Use `spreadsheets.values.append` with `valueInputOption: 'USER_ENTERED'`
4. Row data array: `[nome, dataChegada, dataPartida, levaCarro, localPartida, tendaEntregue, observacoes]`

**Column order in sheet:**
1. Nome (Name)
2. Data chegada (Arrival Date)
3. Data de partida (Departure Date)
4. Leva carro? (Car?)
5. Local partida (Departure Location)
6. Tenda entregue (Tent Delivered)
7. Observações (Observations)

**Error Handling:**
- If API call fails:
  - Log error with context: `logger.error({ err, userId }, 'Failed to save onboarding data to Google Sheets')`
  - Show user: "Failed to save your data. Please try /onboarding again or contact an admin."
  - Do NOT update user status to 'WAITING_PAYMENT'
  - User can retry `/onboarding` (will overwrite STARTED status)

**Environment Variables:**
- `GOOGLE_SPREADSHEET_ID`: The spreadsheet ID (existing)
- `ONBOARDING_SHEET_ID`: The specific sheet/tab ID for onboarding data (new)

## Admin Notifications

### When: User completes onboarding form

**Trigger:** After successful `addOnboardingData()` call and status update to 'WAITING_PAYMENT'

**Recipient:** First admin ID in `ADMIN_IDS` array (parsed from environment variable)

**Message Format:**

```
🔔 New Onboarding Submission

User: @username (ID: 123456)
Status: Waiting payment confirmation

Use /confirm 123456 to approve and send invite link.
```

**Implementation:**
```typescript
const adminIds = JSON.parse(process.env.ADMIN_IDS || '[]');
if (adminIds.length > 0) {
  await bot.api.sendMessage(adminIds[0], notificationMessage);
}
```

**Error Handling:**
- If notification fails: Log error but continue (user status is already updated)
- Admin can still discover pending users via `/pending` command

## Invite Link Generation

### Telegram API: `createChatInviteLink`

**Parameters:**
```typescript
{
  chat_id: GROUP_CHAT_ID,           // From environment variable
  member_limit: 1,                   // Single-use only
  name: `Invite for @${username}`    // For admin tracking in group settings
}
```

**Behavior:**
- Link expires after 1 person joins (member_limit: 1)
- No time-based expiration (user can join whenever they're ready)
- Link is tracked by Telegram with the name for admin reference

**Error Handling:**
- Bot must be admin in the target group with "Invite users" permission
- If generation fails:
  - Log: `logger.error({ err, userId, chatId: GROUP_CHAT_ID }, 'Failed to create invite link')`
  - Notify admin: "Failed to create invite link for @username. Check bot admin permissions in the group."
  - Do NOT update user status to COMPLETED
  - Admin can retry `/confirm` command

## Payment Instructions

### When: After user submits onboarding form

**Message content:**

```
Thanks! Your information has been submitted.

To join the 2026 group, we need a €50 transfer to Daniel.
This can be done via MBWay or Revolut.

MBWay: {configured in i18n as $mbwayNumber}
Revolut: {button with configured deeplink}

Once your payment is confirmed, you'll receive an invite link to join the 2026 group.
```

**Buttons:**
- Revolut deeplink button (opens Revolut app/web directly to Daniel's profile)

**Configuration (in i18n files):**
- `$mbwayNumber`: MBWay phone number variable (e.g., "+351 912 345 678")
- `$revolutLink`: Revolut profile deeplink URL (e.g., "https://revolut.me/username")
- Amount (€50): Hardcoded in message text
- Recipient name (Daniel): Hardcoded in message text

**Note:** No payment proof required. Users can ping admin directly if needed. Admin confirms manually based on bank notifications.

## Error Handling

### Conversation Errors

**Invalid date format:**
- Show: "I couldn't understand that date. Try 'tomorrow', '15/05/2026', or click 'Don't know'"
- Allow retry
- Log: `logger.warn({ userId, input }, 'Failed to parse date')`

**Network/timeout during conversation:**
- Show: "Something went wrong. Please try again with /onboarding"
- Conversation exits
- User record remains in 'STARTED' status
- Log: `logger.error({ err, userId }, 'Conversation error')`

**User exits mid-conversation (closes chat, etc.):**
- grammY handles cleanup automatically
- User record remains in 'STARTED' status
- User can continue later or `/cancel` to restart

### Database Errors

**Connection failure:**
- Log: `logger.error({ err }, 'Database connection failed')`
- Show user: "Database error. Please try again later."
- Command/conversation exits gracefully

**Query errors:**
- Log: `logger.error({ err, userId, operation }, 'Database query failed')`
- Show context-appropriate error message
- Don't expose internal details to user

**All DB errors include context:**
```typescript
logger.error({
  err,
  userId,
  operation: 'createUser' | 'updateStatus' | 'getPending' | 'deleteUser'
}, 'Database operation failed');
```

### Google Sheets API Errors

**Authentication failure:**
- Log: `logger.error({ err }, 'Google Sheets authentication failed')`
- Show: "Failed to save data. Please contact admin."
- Likely indicates credential issue (admin must fix)

**Rate limit exceeded:**
- Log: `logger.warn({ err, userId }, 'Google Sheets rate limit')`
- Show: "Service temporarily unavailable. Please try again in a few minutes."
- User can retry `/onboarding`

**Network timeout:**
- Log: `logger.error({ err, userId }, 'Google Sheets timeout')`
- Show: "Failed to save your data. Please try /onboarding again."
- User retries from beginning

**Invalid sheet ID (configuration error):**
- Log: `logger.error({ err, sheetId: process.env.ONBOARDING_SHEET_ID }, 'Invalid sheet ID')`
- Show: "Configuration error. Please contact admin."
- Admin must fix environment variable

**All Sheets errors include context:**
```typescript
logger.error({
  err,
  userId,
  operation: 'addOnboardingData',
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
  sheetId: process.env.ONBOARDING_SHEET_ID
}, 'Google Sheets API error');
```

### Invite Link Generation Errors

**Bot lacks permissions:**
- Log: `logger.error({ err, chatId: GROUP_CHAT_ID }, 'Bot lacks invite permission')`
- Notify admin: "Failed to create invite link. Check bot admin permissions in the group."
- User status remains 'WAITING_PAYMENT'
- Admin fixes permissions and retries `/confirm`

**Invalid chat ID (configuration error):**
- Log: `logger.error({ err, chatId: process.env.GROUP_CHAT_ID }, 'Invalid GROUP_CHAT_ID')`
- Notify admin: "Invalid GROUP_CHAT_ID configuration."
- Admin must fix environment variable

**Telegram API failure:**
- Log: `logger.error({ err, userId }, 'Telegram API error creating invite')`
- Notify admin: "Telegram API error. Please try /confirm again."
- Transient error, retry usually works

### Admin Command Errors

**Invalid user_id format (`/confirm abc`):**
- Show: "Invalid user ID. Please use: /confirm <user_id>"

**User not found:**
- Show: "User ID 123456 not found in database."

**Wrong status (user already completed):**
- Show: "User @username is not waiting for payment (current status: COMPLETED)"

**Not authorized (non-admin tries admin command):**
- Show: "You're not authorized to use this command."
- Log: `logger.warn({ userId, command }, 'Unauthorized admin command attempt')`

## Multilingual Support (i18n)

The bot uses the existing grammY i18n plugin. New translation files will be created for onboarding strings.

### New Files

- `locales/en/onboarding.ftl`
- `locales/pt/onboarding.ftl`

### Translation Keys

#### Commands & Status Messages

```
onboarding-start-welcome = Welcome! To join the 2026 festival group, please complete the onboarding process using /onboarding

onboarding-already-started = You already started onboarding. Please continue answering the questions, or use /cancel to restart.

onboarding-already-waiting = You already submitted your onboarding! Please wait for payment confirmation.

onboarding-already-completed = You're already registered for 2026!

onboarding-cancelled = Onboarding cancelled. You can start again with /onboarding anytime.

onboarding-nothing-to-cancel = Nothing to cancel. Use /onboarding to check your status.
```

#### Conversation Steps

```
onboarding-name-confirm = I see your name is **{$name}** from your Telegram profile. Is this correct?

onboarding-name-enter = Please enter your name:

onboarding-arrival-date = When do you plan to arrive?

onboarding-departure-date = When do you plan to leave?

onboarding-date-help = (e.g., 'tomorrow', 'next Friday', '15/05/2026', or click 'Don't know')

onboarding-date-confirm = Got it! **{$date}**. Correct?

onboarding-date-invalid = I couldn't understand that date. Please try again or click 'Don't know'

onboarding-car-question = Will you be traveling by car?

onboarding-departure-location = Where will you be departing from?

onboarding-additional-info = Any additional information you'd like to share? (Optional)

onboarding-summary =
  Please review your information:

  Name: {$name}
  Arrival: {$arrival}
  Departure: {$departure}
  Car: {$car}
  {$departureLocation ->
    [empty] {""}
    *[other] Departing from: {$departureLocation}
  }
  {$additionalInfo ->
    [empty] {""}
    *[other] Additional info: {$additionalInfo}
  }

  Is this correct?

onboarding-payment-instructions =
  Thanks! Your information has been submitted.

  To join the 2026 group, we need a €50 transfer to Daniel.
  This can be done via MBWay or Revolut.

  MBWay: {$mbwayNumber}

  Once your payment is confirmed, you'll receive an invite link to join the 2026 group.

onboarding-invite-sent =
  Payment confirmed! Here's your invite link to join the 2026 group: {$inviteLink}

  This link is single-use and will expire after you join.
```

#### Button Labels

```
onboarding-btn-confirm = ✓ Yes, that's correct
onboarding-btn-edit = ✏️ No, let me type it
onboarding-btn-dont-know = 🤷 Don't know yet
onboarding-btn-enter-date = 📅 Enter date
onboarding-btn-yes-car = 🚗 Yes
onboarding-btn-no-car = ❌ No
onboarding-btn-skip = ⏭️ Skip
onboarding-btn-submit = ✅ Submit
onboarding-btn-cancel = ❌ Cancel
```

#### Admin Messages

```
onboarding-admin-notification =
  🔔 New Onboarding Submission

  User: @{$username} (ID: {$userId})
  Status: Waiting payment confirmation

  Use /confirm {$userId} to approve and send invite link.

onboarding-admin-confirm-success = ✅ Invite sent to @{$username} (ID: {$userId})

onboarding-admin-pending-empty = No pending onboarding submissions.

onboarding-admin-pending-started = Started ({$count}):
onboarding-admin-pending-waiting = Waiting Payment ({$count}):

onboarding-admin-error-not-found = User ID {$userId} not found in database.
onboarding-admin-error-wrong-status = User @{$username} is not waiting for payment (current status: {$status})
onboarding-admin-error-unauthorized = You're not authorized to use this command.
onboarding-admin-error-invalid-id = Invalid user ID. Please use: /confirm <user_id>
onboarding-admin-error-invite-failed = Failed to create invite link. Please try again or check bot permissions.
onboarding-admin-error-config = Invalid GROUP_CHAT_ID configuration.
```

#### Special Values (for Sheet Data)

```
onboarding-dont-know = Don't know
onboarding-yes = Yes
onboarding-no = No
```

**Portuguese equivalents in `locales/pt/onboarding.ftl`:**
```
onboarding-dont-know = Não sei
onboarding-yes = Sim
onboarding-no = Não
```

## Environment Variables

### New Variables

Add to `.env` and `.env.example`:

```env
# Onboarding 2026 Configuration
ONBOARDING_SHEET_ID=<sheet_id_for_onboarding_tab>
```

**Setup:** Admin must create the onboarding sheet tab in the existing Google Spreadsheet with columns:
`Nome | Data chegada | Data de partida | Leva carro? | Local partida | Tenda entregue | Observações`

### Renamed Variables

```env
# Before:
CHAT_ID=<telegram_group_id>

# After:
GROUP_CHAT_ID=<telegram_group_id>
```

**Migration:** Update all references in codebase from `process.env.CHAT_ID` to `process.env.GROUP_CHAT_ID`

### Existing Variables (Used by Onboarding)

- `ADMIN_IDS` - JSON array of admin user IDs: `[123456789, 987654321]`
- `GOOGLE_SPREADSHEET_ID` - The spreadsheet containing both expense and onboarding sheets
- `BOT_DEVELOPMENT_TOKEN` / `BOT_STAGING_TOKEN` / `BOT_PRODUCTION_TOKEN` - Bot tokens for different environments

## Dependencies

### New Dependencies to Add

```json
{
  "chrono-node": "^2.7.5"
}
```

**Purpose:** Natural language date parsing in multiple languages (English, Portuguese)

**Usage:**
```typescript
import * as chrono from 'chrono-node';

const parsed = chrono.parseDate('next Friday', new Date(), { forwardDate: true });
```

### Existing Dependencies (Used by Onboarding)

- `grammy` - Bot framework
- `@grammyjs/conversations` - Conversation management
- `@grammyjs/i18n` - Internationalization
- `better-sqlite3` - SQLite database
- `googleapis` - Google Sheets API
- `pino` - Logging

## Testing Considerations

### Unit Tests

**Files to test:**
- `src/storage/userRepository.ts` - CRUD operations
- `src/googleApi/googleSheetsApi.ts` - `addOnboardingData()` function
- Date parsing logic with chrono-node

**Test cases:**
- User creation/update/deletion
- Status transitions
- Pending users query
- Google Sheets row formatting
- Natural language date parsing (various formats, locales)

### Integration Tests

**Scenarios:**
- Complete onboarding flow (conversation from start to finish)
- Admin commands (pending, confirm)
- Error handling (invalid dates, failed API calls)
- Status checks and guards (prevent duplicate onboarding)

### Manual Testing Checklist

- [ ] `/start` shows onboarding instructions
- [ ] `/onboarding` starts conversation for new user
- [ ] `/onboarding` shows appropriate message for existing users (STARTED/WAITING_PAYMENT/COMPLETED)
- [ ] Conversation collects all fields correctly
- [ ] Natural language dates work in both EN and PT
- [ ] "Don't know" buttons work for optional fields
- [ ] Summary shows all collected data correctly
- [ ] Data is written to correct Google Sheet
- [ ] Admin receives notification
- [ ] `/pending` shows users in STARTED and WAITING_PAYMENT
- [ ] `/confirm` generates single-use invite link
- [ ] Invite link works and expires after one use
- [ ] User status updates to COMPLETED after confirmation
- [ ] `/cancel` works and allows restart
- [ ] Error messages are user-friendly and localized
- [ ] All errors are logged with appropriate context

## Implementation Notes

### File Structure

**New files:**
```
src/
  botsCommands/
    onboardingCommands.ts          # Commands: /onboarding, /pending, /confirm, /cancel
  conversations/
    onboardingConversation.ts      # Conversation handler with inline keyboards
  storage/
    userRepository.ts              # User CRUD operations

locales/
  en/
    onboarding.ftl                 # English translations
  pt/
    onboarding.ftl                 # Portuguese translations

docs/
  superpowers/
    specs/
      2026-04-30-onboarding-2026-design.md  # This document
```

**Modified files:**
```
src/
  bots/
    mainBot.ts                     # Register conversation and commands
  types/
    types.ts                       # Add User type, update BotContext if needed
  config/
    environment.ts                 # Validate new env vars

.env.example                       # Add ONBOARDING_SHEET_ID
README.md                          # Document onboarding feature (optional)
```

### Development Branch

**Branch name:** `feature/onboarding-2026`

**Branch from:** `master`

**Merge strategy:** Create pull request when complete, review before merging to `master`

### Implementation Order

1. **Database layer**: Create `users` table and `userRepository.ts`
2. **Environment**: Add `ONBOARDING_SHEET_ID`, rename `CHAT_ID` to `GROUP_CHAT_ID`
3. **Google Sheets**: Implement `addOnboardingData()` function
4. **i18n**: Create translation files for EN and PT
5. **Conversation**: Build `onboardingConversation.ts` with inline keyboards and chrono-node
6. **Commands**: Implement `/onboarding`, `/pending`, `/confirm`, `/cancel`
7. **Integration**: Register conversation and commands in `mainBot.ts`
8. **Update `/start`**: Add onboarding instructions
9. **Testing**: Unit tests, integration tests, manual testing
10. **Documentation**: Update README if needed

### Migration Checklist

Before deployment:

- [ ] Create onboarding sheet tab in Google Spreadsheet with correct columns
- [ ] Add `ONBOARDING_SHEET_ID` to `.env`
- [ ] Rename `CHAT_ID` to `GROUP_CHAT_ID` in `.env`
- [ ] Update all code references from `CHAT_ID` to `GROUP_CHAT_ID`
- [ ] Ensure bot is admin in target group with "Invite users" permission
- [ ] Install `chrono-node` dependency
- [ ] Run database migrations (create `users` table)
- [ ] Test in development environment first
- [ ] Verify Google Sheets API credentials are valid

## Open Questions / Future Enhancements

### Potential Future Features (Out of Scope for Initial Implementation)

1. **Payment proof upload**: Allow users to upload payment screenshot
2. **Automated payment verification**: Integrate with MBWay/Revolut APIs
3. **Reminder system**: Notify users who started but didn't complete onboarding
4. **Bulk operations**: Admin command to export all onboarding data, bulk approvals
5. **Edit functionality**: Allow users to update information after submission
6. **Language preference migration**: Move language preference from session JSON to `users` table
7. **Analytics**: Track completion rates, time-to-complete, drop-off points
8. **Waitlist**: Handle case where group reaches member limit

### Answered Questions

- **Q:** Should we store onboarding data in DB or just Google Sheets?
  **A:** Google Sheets for user-facing data, DB for technical tracking (status, user_id, timestamps)

- **Q:** Single table or separate tables for language preference and onboarding?
  **A:** Single `users` table consolidates all user-related data

- **Q:** How to handle users trying `/onboarding` multiple times?
  **A:** Check status and show appropriate message, allow `/cancel` to restart if in STARTED state

- **Q:** Natural language date support?
  **A:** Yes, use `chrono-node` for better UX

- **Q:** Should we use buttons or text input?
  **A:** Buttons where practical (yes/no, confirmations, don't know), text for open-ended fields

- **Q:** Work on master or feature branch?
  **A:** Feature branch `feature/onboarding-2026`, merge via PR

---

**End of Specification**
