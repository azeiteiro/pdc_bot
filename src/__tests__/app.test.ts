import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockCreateBot = jest.fn();
const mockBotStop = jest.fn();
const mockBreeStart = jest.fn();
const mockBreeStop = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerFatal = jest.fn();

let capturedBreeConfig: unknown = null;

// Mock Bree class
class MockBree {
  constructor(config: unknown) {
    capturedBreeConfig = config;
  }
  start = mockBreeStart;
  stop = mockBreeStop;
}

// Mock dependencies BEFORE importing app.ts
jest.unstable_mockModule('../config/environment.js', () => ({
  config: {},
}));
jest.unstable_mockModule('../bots/mainBot.js', () => ({
  createBot: mockCreateBot,
}));
jest.unstable_mockModule('bree', () => ({
  default: MockBree,
}));
jest.unstable_mockModule('../jobs/index.js', () => ({
  jobs: [],
}));
jest.unstable_mockModule('../utils/logger.js', () => ({
  default: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    fatal: mockLoggerFatal,
  },
}));

const flushPromises = () => new Promise(setImmediate);

describe('app.ts', () => {
  const originalExit = process.exit;
  const originalOnce = process.once;
  const originalOn = process.on;

  let exitMock: jest.Mock;
  let eventListeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    capturedBreeConfig = null;
    eventListeners = {};

    // Mock process events
    process.once = jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(cb);

      return process;
    }) as unknown as typeof process.once;

    process.on = jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(cb);

      return process;
    }) as unknown as typeof process.on;

    exitMock = jest.fn();
    process.exit = exitMock as unknown as typeof process.exit;

    mockCreateBot.mockResolvedValue({ stop: mockBotStop } as never);
  });

  afterEach(() => {
    process.exit = originalExit;
    process.once = originalOnce;
    process.on = originalOn;
    jest.useRealTimers();
  });

  it('should initialize environment, bot, and job scheduler on load', async () => {
    // Dynamically import the app entry point
    await import(`../app.js?test=${Math.random()}`);

    // Wait for the async startApp to run
    await flushPromises();

    // Assert that createBot was called
    expect(mockCreateBot).toHaveBeenCalledTimes(1);
    // Assert that Bree start was called
    expect(mockBreeStart).toHaveBeenCalledTimes(1);
    expect(mockLoggerInfo).toHaveBeenCalledWith('✅ Job scheduler started');
  });

  it('should handle bree worker messages and errors', async () => {
    await import(`../app.js?test=${Math.random()}`);
    await flushPromises();

    expect(capturedBreeConfig).toBeDefined();

    // Trigger worker message
    capturedBreeConfig.workerMessageHandler('test message');
    expect(mockLoggerInfo).toHaveBeenCalledWith({ message: 'test message' }, 'Job worker message');

    // Trigger worker error
    const testError = new Error('worker error');

    capturedBreeConfig.errorHandler(testError, { name: 'testJob' });
    expect(mockLoggerError).toHaveBeenCalledWith(
      { err: testError, worker: { name: 'testJob' } },
      'Job error',
    );
  });

  it('should handle SIGINT gracefully', async () => {
    await import(`../app.js?test=${Math.random()}`);
    await flushPromises();

    // Trigger SIGINT
    const sigintHandlers = eventListeners['SIGINT'] || [];

    expect(sigintHandlers.length).toBeGreaterThan(0);

    await sigintHandlers[0]();

    expect(mockLoggerInfo).toHaveBeenCalledWith('Received SIGINT, shutting down...');
    expect(mockBreeStop).toHaveBeenCalledTimes(1);
    expect(mockBotStop).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it('should handle SIGTERM gracefully', async () => {
    await import(`../app.js?test=${Math.random()}`);
    await flushPromises();

    // Trigger SIGTERM
    const sigtermHandlers = eventListeners['SIGTERM'] || [];

    expect(sigtermHandlers.length).toBeGreaterThan(0);

    await sigtermHandlers[0]();

    expect(mockLoggerInfo).toHaveBeenCalledWith('Received SIGTERM, shutting down...');
    expect(mockBreeStop).toHaveBeenCalledTimes(1);
    expect(mockBotStop).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it('should catch startApp errors, log them, and exit', async () => {
    const testError = new Error('bot init failed');

    mockCreateBot.mockRejectedValueOnce(testError as never);

    await import(`../app.js?test=${Math.random()}`);
    await flushPromises();

    expect(mockLoggerError).toHaveBeenCalledWith({ err: testError }, 'Failed to start application');

    // Check that setTimeout was called or we can just wait 600ms
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('should handle uncaught exceptions', async () => {
    await import(`../app.js?test=${Math.random()}`);
    await flushPromises();

    const uncaughtHandlers = eventListeners['uncaughtException'] || [];

    expect(uncaughtHandlers.length).toBeGreaterThan(0);

    const testError = new Error('uncaught');

    uncaughtHandlers[0](testError);

    expect(mockLoggerFatal).toHaveBeenCalledWith({ err: testError }, 'Uncaught Exception');

    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('should handle unhandled rejections', async () => {
    await import(`../app.js?test=${Math.random()}`);
    await flushPromises();

    const unhandledHandlers = eventListeners['unhandledRejection'] || [];

    expect(unhandledHandlers.length).toBeGreaterThan(0);

    const testReason = new Error('unhandled');

    unhandledHandlers[0](testReason);

    expect(mockLoggerFatal).toHaveBeenCalledWith({ err: testReason }, 'Unhandled Rejection');

    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});
