import { describe, it, expect } from '@jest/globals';
import { buildRevolutPaymentLink, buildPaypalPaymentLink } from '../../utils/paymentLink.js';

describe('buildRevolutPaymentLink', () => {
  it('builds a URL with the sanitized plain ASCII name', () => {
    expect(buildRevolutPaymentLink('John Smith', 50)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_John_Smith',
    );
  });

  it('strips diacritics from accented names', () => {
    expect(buildRevolutPaymentLink('João Silva', 50)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_Joao_Silva',
    );
  });

  it('collapses irregular whitespace into single underscores', () => {
    expect(buildRevolutPaymentLink('  Ana   Costa ', 50)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_Ana_Costa',
    );
  });

  it('strips punctuation and collapses underscores', () => {
    expect(buildRevolutPaymentLink("Anne-Marie O'Neil", 50)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_AnneMarie_ONeil',
    );
  });

  it('falls back to "user" for an empty or whitespace-only name', () => {
    expect(buildRevolutPaymentLink('   ', 50)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_user',
    );
    expect(buildRevolutPaymentLink('', 50)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=5000&note=PDC_2026_user',
    );
  });

  it('uses a custom noteLabel when provided', () => {
    expect(buildRevolutPaymentLink('João Silva', 25.5, 'PDC_2026_Settlement')).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=2550&note=PDC_2026_Settlement_Joao_Silva',
    );
  });

  it('rounds fractional euro amounts to the nearest cent', () => {
    expect(buildRevolutPaymentLink('John Smith', 49.99)).toBe(
      'https://revolut.me/azeiteiro?currency=EUR&amount=4999&note=PDC_2026_John_Smith',
    );
  });

  it('sanitizes a malformed noteLabel instead of throwing', () => {
    expect(() => buildRevolutPaymentLink('John Smith', 50, 'BAD_\uD800_LABEL')).not.toThrow();
  });
});

describe('buildPaypalPaymentLink', () => {
  it('builds a PayPal.me URL with a 2-decimal amount', () => {
    expect(buildPaypalPaymentLink('azeiteiro', 25.5)).toBe('https://paypal.me/azeiteiro/25.50EUR');
  });

  it('formats a whole-euro amount with 2 decimals', () => {
    expect(buildPaypalPaymentLink('azeiteiro', 25)).toBe('https://paypal.me/azeiteiro/25.00EUR');
  });
});
