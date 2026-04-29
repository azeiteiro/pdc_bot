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

# Language selection
language-selection-prompt = Choose your language:

language-changed = Language changed to English ✅
