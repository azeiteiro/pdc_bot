import { describe, it, expect, jest } from '@jest/globals';

// To mock correctly with Jest ESM and unstable_mockModule, we must use the exact string used in the source file
jest.unstable_mockModule('../../jobs/dailyMessage.js', () => ({
  name: 'dailyMessage',
  cron: '0 9 * * *',
}));

describe('Job Registry (index.ts)', () => {
  it('should export an array of jobs', async () => {
    // Import dynamically after mocking
    const { jobs } = await import('../../jobs/index.js');

    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('should include the dailyMessage job configuration', async () => {
    const { jobs } = await import('../../jobs/index.js');

    const dailyMessageJob = jobs.find((j) => j.name === 'dailyMessage');

    expect(dailyMessageJob).toBeDefined();
    expect(dailyMessageJob?.cron).toBe('0 9 * * *');
    expect(dailyMessageJob?.worker?.workerData?.jobName).toBe('dailyMessage');
  });
});
