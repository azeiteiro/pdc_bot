import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockCreateBot = jest.fn();

// Mock dependencies BEFORE importing app.ts
jest.unstable_mockModule('dotenv/config', () => ({}));
jest.unstable_mockModule('../config/environment.js', () => ({
  config: {},
}));
jest.unstable_mockModule('../bots/mainBot.js', () => ({
  createBot: mockCreateBot,
}));

describe('app.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize environment and call createBot on load', async () => {
    // Dynamically import the app entry point
    await import('../app.js');

    // Assert that createBot was called
    expect(mockCreateBot).toHaveBeenCalledTimes(1);
  });
});
