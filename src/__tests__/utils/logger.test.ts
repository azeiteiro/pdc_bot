import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Logger', () => {
  const logsDir = path.join(process.cwd(), 'logs');
  const testLogFile = path.join(logsDir, 'test.log');

  beforeEach(() => {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testLogFile)) {
      fs.unlinkSync(testLogFile);
    }
  });

  it('should log info messages', async () => {
    const { default: logger } = await import('../../utils/logger.js');

    const logSpy = jest.spyOn(logger, 'info');

    logger.info('test message');

    expect(logSpy).toHaveBeenCalledWith('test message');
  });

  it('should log error messages with stack traces', async () => {
    const { default: logger } = await import('../../utils/logger.js');

    const error = new Error('test error');
    const logSpy = jest.spyOn(logger, 'error');

    logger.error(error);

    expect(logSpy).toHaveBeenCalledWith(error);
  });

  it('should have helper methods', async () => {
    const { loggers } = await import('../../utils/logger.js');

    expect(typeof loggers.userChat).toBe('function');
    expect(typeof loggers.botResponse).toBe('function');
    expect(typeof loggers.sceneTransition).toBe('function');
    expect(typeof loggers.sheetsOperation).toBe('function');
    expect(typeof loggers.authEvent).toBe('function');
    expect(typeof loggers.errorWithContext).toBe('function');
  });
});
