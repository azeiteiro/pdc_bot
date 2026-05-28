import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Logger', () => {
  let logger: Awaited<typeof import('../../utils/logger.js')>['default'];
  let loggers: Awaited<typeof import('../../utils/logger.js')>['loggers'];
  let infoSpy: ReturnType<typeof jest.spyOn>;
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(async () => {
    const mod = await import('../../utils/logger.js');

    logger = mod.default;
    loggers = mod.loggers;
    infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => logger);
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs info messages', () => {
    logger.info('test message');
    expect(infoSpy).toHaveBeenCalledWith('test message');
  });

  it('logs error messages', () => {
    const error = new Error('test error');

    logger.error(error);
    expect(errorSpy).toHaveBeenCalledWith(error);
  });

  describe('loggers.userChat', () => {
    it('spreads object metadata', () => {
      loggers.userChat(123, 'hello', { extra: 'data' });
      expect(infoSpy).toHaveBeenCalledWith({ userId: 123, extra: 'data' }, 'User 123: hello');
    });

    it('wraps string metadata', () => {
      loggers.userChat(123, 'hello', 'some-meta');
      expect(infoSpy).toHaveBeenCalledWith(
        { userId: 123, metadata: 'some-meta' },
        'User 123: hello',
      );
    });
  });

  describe('loggers.botResponse', () => {
    it('spreads object metadata', () => {
      loggers.botResponse(456, 'reply', { key: 'value' });
      expect(infoSpy).toHaveBeenCalledWith(
        { userId: 456, key: 'value' },
        'Bot response to 456: reply',
      );
    });

    it('wraps string metadata', () => {
      loggers.botResponse(456, 'reply', 'meta-string');
      expect(infoSpy).toHaveBeenCalledWith(
        { userId: 456, metadata: 'meta-string' },
        'Bot response to 456: reply',
      );
    });
  });

  describe('loggers.sceneTransition', () => {
    it('logs scene transition', () => {
      loggers.sceneTransition(789, 'idle', 'active');
      expect(infoSpy).toHaveBeenCalledWith(
        { userId: 789, from: 'idle', to: 'active' },
        'User 789 scene transition: idle -> active',
      );
    });
  });

  describe('loggers.sheetsOperation', () => {
    it('logs success with object details', () => {
      loggers.sheetsOperation('write', true, { rows: 3 });
      expect(infoSpy).toHaveBeenCalledWith(
        { operation: 'write', rows: 3 },
        'Google Sheets write successful',
      );
    });

    it('logs failure with string details', () => {
      loggers.sheetsOperation('read', false, 'quota exceeded');
      expect(errorSpy).toHaveBeenCalledWith(
        { operation: 'read', details: 'quota exceeded' },
        'Google Sheets read failed',
      );
    });
  });

  describe('loggers.authEvent', () => {
    it('logs auth event with metadata', () => {
      loggers.authEvent('login', 111, { ip: '127.0.0.1' });
      expect(infoSpy).toHaveBeenCalledWith(
        { event: 'login', userId: 111, ip: '127.0.0.1' },
        'Auth event: login',
      );
    });
  });

  describe('loggers.errorWithContext', () => {
    it('logs error with context and metadata', () => {
      const error = new Error('boom');

      loggers.errorWithContext(error, 'payment', { txId: 'abc' });
      expect(errorSpy).toHaveBeenCalledWith(
        { err: error, context: 'payment', txId: 'abc' },
        'Error in payment: boom',
      );
    });
  });
});
