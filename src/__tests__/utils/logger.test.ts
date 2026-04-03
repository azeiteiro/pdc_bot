import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock fs to avoid creating log folders during tests
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

import logger, { loggers } from '../../utils/logger.js';

describe('logger', () => {
  let infoSpy: jest.Mock;
  let errorSpy: jest.Mock;

  beforeEach(() => {
    infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => logger) as unknown as jest.Mock;
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger) as unknown as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loggers helpers', () => {
    it('should log userChat correctly', () => {
      loggers.userChat('user123', 'hello', { data: 'test' });
      expect(infoSpy).toHaveBeenCalledWith('User user123: hello', { data: 'test' });
    });

    it('should log botResponse correctly', () => {
      loggers.botResponse('user123', 'response message', { data: 'test' });
      expect(infoSpy).toHaveBeenCalledWith('Bot response to user123: response message', {
        data: 'test',
      });
    });

    it('should log sceneTransition correctly', () => {
      loggers.sceneTransition('user123', 'start', 'end');
      expect(infoSpy).toHaveBeenCalledWith('User user123 scene transition: start -> end');
    });

    it('should log sheetsOperation success correctly', () => {
      loggers.sheetsOperation('read', true, { rows: 5 });
      expect(infoSpy).toHaveBeenCalledWith('Google Sheets read successful', { rows: 5 });
    });

    it('should log sheetsOperation failure correctly', () => {
      loggers.sheetsOperation('write', false, { error: 'timeout' });
      expect(errorSpy).toHaveBeenCalledWith('Google Sheets write failed', { error: 'timeout' });
    });

    it('should log authEvent correctly', () => {
      loggers.authEvent('login', 'user123', { ip: '127.0.0.1' });
      expect(infoSpy).toHaveBeenCalledWith('Auth event: login', {
        userId: 'user123',
        ip: '127.0.0.1',
      });
    });

    it('should log errorWithContext correctly', () => {
      const error = new Error('test error');

      loggers.errorWithContext(error, 'testContext', { extra: 'data' });

      expect(errorSpy).toHaveBeenCalledWith('Error in testContext: test error', {
        stack: error.stack,
        extra: 'data',
      });
    });
  });
});
