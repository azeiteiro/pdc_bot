const formatName = (name: string) => {
  if (!name || name === 'Unknown') {
    return 'Unknown';
  }

  // Convert to string and trim whitespace
  const nameStr = String(name).trim();

  if (!nameStr) {
    return 'Unknown';
  }

  // Split by spaces and filter out empty strings
  const nameParts = nameStr.split(' ').filter((part) => part.length > 0);

  if (nameParts.length === 0) {
    return 'Unknown';
  } else if (nameParts.length === 1) {
    // Single name - return as is
    return nameParts[0];
  } else {
    // Multiple names - first name + first letter of last name with dot
    const firstName = nameParts[0];
    const lastNameInitial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();

    return `${firstName} ${lastNameInitial}.`;
  }
};

// Helper function to parse DD/MM/YYYY format
const parseDDMMYYYY = (dateStr: string): Date => {
  if (!dateStr || dateStr === 'Unknown date') {
    return new Date(0); // Return epoch for unknown dates
  }

  try {
    const [day, month, year] = dateStr.split('/');
    // Month is 0-indexed in JavaScript Date constructor

    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } catch {
    return new Date(0);
  }
};

// Helper function to parse Euro amounts (€123 -> 123)
const parseEuroAmount = (amountStr: string): number => {
  if (!amountStr) return 0;

  // Remove € symbol and any whitespace, then convert to number
  const numericValue = amountStr.replace('€', '').trim();

  return parseFloat(numericValue) || 0;
};

// Helper function to format date headers
const formatDateHeader = (dateStr: string): string => {
  if (dateStr === 'Unknown date') {
    return 'Unknown date';
  }

  try {
    const date = parseDDMMYYYY(dateStr);
    const today = new Date();
    const yesterday = new Date(today);

    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time for comparison
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) {
      return 'Today';
    }

    if (date.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }

    // Format as "Monday, Jan 15"
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const formatExpenses = (expenses: string[][]): string => {
  if (!expenses || expenses.length === 0) {
    return 'No expenses found.';
  }

  // Filter out empty rows
  const validExpenses = expenses.filter((row) => row[0] !== undefined && row[0] !== '');

  if (validExpenses.length === 0) {
    return 'No expenses found.';
  }

  // Separate the total row from regular expenses
  const totalRow = validExpenses[validExpenses.length - 1];
  const regularExpenses = validExpenses.slice(0, -1);

  if (regularExpenses.length === 0) {
    return 'No expenses found.';
  }

  // Group regular expenses by date
  const groupedByDate = regularExpenses.reduce(
    (groups, row) => {
      const date = row[3] || 'Unknown date';

      if (!groups[date]) {
        groups[date] = [];
      }

      groups[date].push(row);

      return groups;
    },
    {} as { [key: string]: string[][] },
  );

  const parseDate = (dateStr: string): number => {
    if (dateStr === 'Unknown date') return -Infinity;

    const [day, month, year] = dateStr.split('/');
    const iso = `${year}-${month}-${day}`;

    return new Date(iso).getTime();
  };

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
    if (a === 'Unknown date') return 1;
    if (b === 'Unknown date') return -1;

    return parseDate(a) - parseDate(b); // Ascending
  });

  // Format the grouped expenses
  const formattedExpenses = sortedDates
    .map((date) => {
      const expensesForDate = groupedByDate[date];
      const dateHeader = formatDateHeader(date);

      // Calculate daily total
      const dailyTotal = expensesForDate.reduce(
        (sum, row) => sum + parseEuroAmount(row[1] || '€0'),
        0,
      );

      const expenseList = expensesForDate
        .map(
          (row) => `  • <b>${row[1]}</b> - <code>${row[0]}</code> (<i>${formatName(row[2])}</i>)`,
        )
        .join('\n');

      return `📅 <b>${dateHeader}</b> - Total: <code>€${dailyTotal.toFixed(2)}</code>\n${expenseList}`;
    })
    .join('\n\n');

  // Add the grand total at the end
  const grandTotal = `\n\n💰 <b>Grand Total: ${totalRow[1]}</b>`;

  return formattedExpenses + grandTotal;
};
