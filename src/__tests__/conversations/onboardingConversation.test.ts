import * as chrono from 'chrono-node';

describe('onboardingConversation', () => {
  describe('date parsing', () => {
    it('should parse natural language dates in English', () => {
      const today = new Date();
      const tomorrow = chrono.en.parseDate('tomorrow', today, { forwardDate: true });
      const expectedDate = new Date(today);

      expectedDate.setDate(expectedDate.getDate() + 1);

      expect(tomorrow).toBeDefined();
      expect(tomorrow?.getTime()).toBeGreaterThan(today.getTime());
    });

    it('should parse natural language dates in Portuguese', () => {
      const today = new Date();
      const amanha = chrono.pt.parseDate('amanhã', today, { forwardDate: true });
      const expectedDate = new Date(today);

      expectedDate.setDate(expectedDate.getDate() + 1);

      expect(amanha).toBeDefined();
      expect(amanha?.getTime()).toBeGreaterThan(today.getTime());
    });

    it('should parse formatted dates', () => {
      const parsed = chrono.parseDate('15/05/2026', new Date(), { forwardDate: true });

      expect(parsed).toBeDefined();
      expect(parsed?.getMonth()).toBe(4); // May (0-indexed)
      expect(parsed?.getDate()).toBe(15);
    });

    it('should return null for invalid dates', () => {
      const parsed = chrono.parseDate('not a date', new Date(), { forwardDate: true });

      expect(parsed).toBeNull();
    });
  });
});
