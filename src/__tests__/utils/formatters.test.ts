import { describe, it, expect } from '@jest/globals';
import { formatExpenses } from '../../utils/formatters.js';

// Since we're using ESM, we might need to mock some things if we were testing complex logic,
// but for these pure-ish functions, we can test the output of formatExpenses directly
// or test the internal helpers if they were exported.
// Since only formatExpenses is exported, let's test it.

describe('formatters', () => {
  describe('formatExpenses', () => {
    it('should return "No expenses found." for empty input', () => {
      expect(formatExpenses([])).toBe('No expenses found.');
      expect(formatExpenses([['', '', '', '']])).toBe('No expenses found.');
    });

    it('should format expenses correctly grouped by date', () => {
      const expenses = [
        ['Coffee', '€3.50', 'John Doe', '01/01/2026'],
        ['Lunch', '€15.00', 'Jane Smith', '01/01/2026'],
        ['Beer', '€5.00', 'John Doe', '02/01/2026'],
        ['Total', '€23.50', '', ''], // Total row
      ];

      const result = formatExpenses(expenses);

      // Check for date headers
      expect(result).toContain('📅 <b>Thursday, Jan 1</b>');
      expect(result).toContain('📅 <b>Friday, Jan 2</b>');

      // Check for totals
      expect(result).toContain('Total: <code>€18.50</code>'); // 3.5 + 15
      expect(result).toContain('Total: <code>€5.00</code>');

      // Check for individual items
      expect(result).toContain('• <b>€3.50</b> - <code>Coffee</code> (<i>John D.</i>)');
      expect(result).toContain('• <b>€15.00</b> - <code>Lunch</code> (<i>Jane S.</i>)');
      expect(result).toContain('• <b>€5.00</b> - <code>Beer</code> (<i>John D.</i>)');

      // Check for grand total
      expect(result).toContain('💰 <b>Grand Total: €23.50</b>');
    });

    it('should handle "Unknown" names correctly', () => {
      const expenses = [
        ['Water', '€1.00', 'Unknown', '01/01/2026'],
        ['Total', '€1.00', '', ''],
      ];

      const result = formatExpenses(expenses);

      expect(result).toContain('(<i>Unknown</i>)');
    });

    it('should handle single names correctly', () => {
      const expenses = [
        ['Water', '€1.00', 'Azeiteiro', '01/01/2026'],
        ['Total', '€1.00', '', ''],
      ];

      const result = formatExpenses(expenses);

      expect(result).toContain('(<i>Azeiteiro</i>)');
    });
  });
});
