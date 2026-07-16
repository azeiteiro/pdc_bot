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

expense-today-keyword = today

# Language selection
language-selection-prompt = Choose your language:

language-changed = Language changed to English ✅

language-error = An error occurred while changing language. Please try again.

language-error-answer = Error changing language

# Onboarding 2026 translations (English)

# Commands & Status Messages
onboarding-start-welcome = Welcome! To join the 2026 festival group, please complete the onboarding process using /onboarding

onboarding-already-started = You already started onboarding. Please continue answering the questions, or use /cancel to restart.

onboarding-already-waiting = You already submitted your onboarding! Please wait for payment confirmation.

onboarding-already-completed = You're already registered for 2026!

onboarding-cancelled = Onboarding cancelled. You can start again with /onboarding anytime.

onboarding-nothing-to-cancel = Nothing to cancel. Use /onboarding to check your status.

# Conversation Steps
onboarding-name-confirm = I see your name is **{$name}** from your Telegram profile. Is this correct?

onboarding-name-enter = Please enter your name:

onboarding-arrival-date = When do you plan to arrive?

onboarding-departure-date = When do you plan to leave?

onboarding-date-help = (e.g., 'tomorrow', 'next Friday', '15/05/2026', or click 'Don't know')

onboarding-date-confirm = Got it! **{$date}**. Correct?

onboarding-date-invalid = I couldn't understand that date. Please try again or click 'Don't know'

onboarding-car-question = Will you be traveling with your own car?

onboarding-departure-location = Where will you be departing from?

onboarding-chairs-question = How many chairs will you bring?

onboarding-btn-chairs-other = 🪑 Other

onboarding-chairs-enter = Please enter the number of chairs you'll bring:

onboarding-chairs-invalid = Please provide a valid whole number (0 or more) for the number of chairs.

onboarding-additional-info = Any additional information you'd like to share? (Optional)

onboarding-summary = Please review your information:

    Name: {$name}
    Arrival: {$arrival}
    Departure: {$departure}
    Car: {$car}
    {$departureLocation ->
      [empty] {""}
      *[other] Departing from: {$departureLocation}

    }
    Chairs: {$chairs}
    {$additionalInfo ->
      [empty] {""}
      *[other] Additional info: {$additionalInfo}

    }
    Is this correct?

onboarding-payment-instructions = Thanks! Your information has been submitted.

    To join the 2026 group, we need a €50 transfer to Daniel Azeiteiro, via MBWay or Revolut.

    MBWay: {$mbwayNumber}

    Once your payment is confirmed, you'll receive an invite link to join the 2026 group.

onboarding-btn-pay-revolut = 💸 Pay via Revolut

onboarding-invite-sent = Payment confirmed! Here's your invite link to join the 2026 group: {$inviteLink}

    This link is single-use and will expire after you join.

onboarding-error-save-failed = Failed to save your data. Please try /onboarding again or contact an admin.

# Button Labels
onboarding-btn-confirm = ✓ Yes, that's correct

onboarding-btn-edit = ✏️ No, let me type it

onboarding-btn-dont-know = 🤷 Don't know yet

onboarding-btn-last-day = 📅 16 Aug · Last day

onboarding-btn-enter-date = 📅 Enter date

onboarding-btn-yes-car = 🚗 Yes

onboarding-btn-no-car = ❌ No

onboarding-btn-skip = ⏭️ Skip

onboarding-btn-submit = ✅ Submit

onboarding-btn-cancel = ❌ Cancel

# Admin Messages
onboarding-admin-notification = 🔔 New Onboarding Submission

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

# Special Values (for Sheet Data)
onboarding-dont-know = Don't know

onboarding-yes = Yes

onboarding-no = No

# General command translations (English)

general-lineup-select-day = Please select the day

general-unknown-error = Unknown error, please try again later

general-expense-private-only = ℹ️ Please use the /expense command in a private chat with me: https://t.me/{$username}

general-about = This bot helps manage everything for the PDC festival: registration, the lineup schedule, and shared group expenses. Use /help to see all commands.

# Utils translations (English)

daily-greeting =
    Hello friends! 👋

    Hope you had a great night.

    Today is {$date}

    {$weatherEmoji} {$weatherDescription} — temperatures between ↘️ <b>{$minTemp}ºC</b> and <b>{$maxTemp}ºC</b> ↗️

    {$precipitationWarning}Chance of rain: <b>{$precipitaProb}%</b>

    Wishing you a beautiful day! ❤️

lineup-header = <b>Line-up for {$day}</b>

# Offboarding translations (English)

offboarding-festival-ended-group =
    Hey everyone! The festival is now over 🎉

    Thank you all for being part of this incredible experience! We hope you had an amazing time.

    We're now calculating shared expenses. You can still add expenses via /expense if you missed anything.

    Stay tuned for the final settlement details!

offboarding-festival-ended-private =
    Hey {$name}! 👋

    The festival is over and what a ride it was! Thank you for being part of it.

    We're now working on calculating all shared expenses. You can still add anything you forgot via /expense.

    We'll be in touch soon with your individual balance. 🙏

offboarding-balance-positive = You have a positive balance of <b>€{$amount}</b> — you'll receive this amount from the group settlement.

offboarding-balance-negative = You have a balance of <b>-€{$amount}</b> — you owe this amount to cover your share of the shared expenses.

offboarding-review-deadline =
    You can review the full expense details here: {$spreadsheetUrl}

    These values become <b>final on {$deadline}</b>. If you have any questions or disputes, please reach out before that date.

offboarding-final-receive =
    Great news! The final settlement is confirmed. You're owed <b>€{$amount}</b>.

    Please send your bank details (IBAN or PayPal) to Daniel so he can transfer the money to you.

offboarding-final-pay =
    The final settlement is confirmed. You owe <b>€{$amount}</b>.

    Please transfer to Daniel Azeiteiro using one of these options:
    • Bank transfer (ask Daniel for IBAN)
    • PayPal
    • MBWay: {$mbwayNumber}
    • Revolut

    Thank you! 🙏

offboarding-admin-summary = Offboarding message sent to {$sent} users. Failed: {$failed}.

info-useful-links =
    <b>Useful links:</b>

    📷 Google Photos Album : <a href="{$albumUrl}">🏳️‍🌈 Paredes de Coura 2026</a>

    ℹ️ Pré-Festival Spreadsheet: <a href="{$spreadsheetUrl}">Pré-Festival Paredes de Coura 2026</a>
