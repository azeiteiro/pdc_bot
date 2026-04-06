import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Define mocks
jest.unstable_mockModule('../../utils/utils.js', () => ({
  generateDailyMessage: jest.fn(),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Daily Message Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export job configuration', async () => {
    const jobModule = await import('../../jobs/dailyMessage.js');

    expect(jobModule).toHaveProperty('name');
    expect(jobModule).toHaveProperty('cron');
    expect(jobModule).toHaveProperty('run');
  });

  it('should have correct cron schedule', async () => {
    const { cron } = await import('../../jobs/dailyMessage.js');

    expect(cron).toBe('0 9 * * *');
  });

  it('should have valid job name', async () => {
    const { name } = await import('../../jobs/dailyMessage.js');

    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });
});
