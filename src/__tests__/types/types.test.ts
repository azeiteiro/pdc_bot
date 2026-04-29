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
