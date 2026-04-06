import pino from 'pino';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// Create pino transport for file logging with rotation
const targets: Array<{
  target: string;
  level: string;
  options: Record<string, unknown>;
}> = [
  {
    target: 'pino/file',
    level: logLevel,
    options: {
      destination: path.join(logsDir, 'combined.log'),
      mkdir: true,
    },
  },
  {
    target: 'pino/file',
    level: 'error',
    options: {
      destination: path.join(logsDir, 'error.log'),
      mkdir: true,
    },
  },
];

// Only add pino-pretty in development (avoids pnpm resolution issues in production)
if (!isProduction) {
  targets.push({
    target: 'pino-pretty',
    level: logLevel,
    options: {
      destination: 1, // stdout
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
    },
  });
}

const transport = pino.transport({ targets });

const logger = pino(
  {
    level: logLevel,
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      env: process.env.NODE_ENV || 'development',
    },
  },
  transport,
);

// Helper methods for common logging patterns
export const loggers = {
  // User interaction logging
  userChat: (userId: string | number, message: string, metadata?: object | string) => {
    logger.info(
      { userId, ...(typeof metadata === 'object' ? metadata : { metadata }) },
      `User ${userId}: ${message}`,
    );
  },

  // Bot response logging
  botResponse: (userId: string | number, message: string, metadata?: object | string) => {
    logger.info(
      { userId, ...(typeof metadata === 'object' ? metadata : { metadata }) },
      `Bot response to ${userId}: ${message}`,
    );
  },

  // Scene transitions
  sceneTransition: (userId: string | number, from: string, to: object | string) => {
    logger.info({ userId, from, to }, `User ${userId} scene transition: ${from} -> ${to}`);
  },

  // Google Sheets operations
  sheetsOperation: (operation: string, success: boolean, details?: object | string) => {
    const logDetails = typeof details === 'object' ? details : { details };

    if (success) {
      logger.info({ operation, ...logDetails }, `Google Sheets ${operation} successful`);
    } else {
      logger.error({ operation, ...logDetails }, `Google Sheets ${operation} failed`);
    }
  },

  // Authentication events
  authEvent: (event: string, userId?: string | number, details?: object) => {
    logger.info({ event, userId, ...details }, `Auth event: ${event}`);
  },

  // Error with context
  errorWithContext: (error: Error, context: string, metadata?: object) => {
    logger.error(
      {
        err: error,
        context,
        ...metadata,
      },
      `Error in ${context}: ${error.message}`,
    );
  },
};

export default logger;
