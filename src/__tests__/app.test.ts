import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockCreateBot = jest.fn();
const mockBreeStart = jest.fn();
const mockBreeStop = jest.fn();

// Mock Bree class
class MockBree {
  start = mockBreeStart;
  stop = mockBreeStop;
}

// Mock dependencies BEFORE importing app.ts
jest.unstable_mockModule('../config/environment.js', () => ({
  config: {},
}));
jest.unstable_mockModule('../bots/mainBot.js', () => ({
  createBot: mockCreateBot.mockResolvedValue({ stop: jest.fn() } as never),
}));
jest.unstable_mockModule('bree', () => ({
  default: MockBree,
}));
jest.unstable_mockModule('../jobs/index.js', () => ({
  jobs: [],
}));
jest.unstable_mockModule('../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('app.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize environment, bot, and job scheduler on load', async () => {
    // Dynamically import the app entry point
    await import('../app.js');

    // Assert that createBot was called
    expect(mockCreateBot).toHaveBeenCalledTimes(1);
    // Assert that Bree start was called
    expect(mockBreeStart).toHaveBeenCalledTimes(1);
  });
});
