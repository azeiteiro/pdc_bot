import winston, { format, transports } from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const logLevel = process.env.LOG_LEVEL || (isTest ? 'silent' : isProduction ? 'info' : 'debug');

// Simple format for production (less CPU/memory)
const simpleFormat = format.printf((info) => {
  const { timestamp, level, message, metadata } = info;
  const meta = metadata && Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';

  return `${timestamp} ${level}: ${message}${meta}`;
});

// Only use colors in development
const consoleFormat = isProduction
  ? format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), simpleFormat)
  : format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.colorize({ all: true }),
      simpleFormat,
    );

const logger = winston.createLogger({
  level: logLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  ),
  transports: [
    // Console output
    new transports.Console({
      format: consoleFormat,
    }),

    // Combined log file (all logs)
    new transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: simpleFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 3,
    }),

    // Error log file (errors only)
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      format: simpleFormat,
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    }),
  ],

  // Handle uncaught exceptions and rejections in main log
  exceptionHandlers: [
    new transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760,
    }),
  ],

  rejectionHandlers: [
    new transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760,
    }),
  ],

  exitOnError: false,
});

// Helper methods for common logging patterns
export const loggers = {
  // User interaction logging
  userChat: (userId: string | number, message: string, metadata?: object | string) => {
    logger.info(`User ${userId}: ${message}`, metadata);
  },

  // Bot response logging
  botResponse: (userId: string | number, message: string, metadata?: object | string) => {
    logger.info(`Bot response to ${userId}: ${message}`, metadata);
  },

  // Scene transitions
  sceneTransition: (userId: string | number, from: string, to: object | string) => {
    logger.info(`User ${userId} scene transition: ${from} -> ${to}`);
  },

  // Google Sheets operations
  sheetsOperation: (operation: string, success: boolean, details?: object | string) => {
    if (success) {
      logger.info(`Google Sheets ${operation} successful`, details);
    } else {
      logger.error(`Google Sheets ${operation} failed`, details);
    }
  },

  // Authentication events
  authEvent: (event: string, userId?: string | number, details?: object) => {
    logger.info(`Auth event: ${event}`, { userId, ...details });
  },

  // Error with context
  errorWithContext: (error: Error, context: string, metadata?: object) => {
    logger.error(`Error in ${context}: ${error.message}`, {
      stack: error.stack,
      ...metadata,
    });
  },
};

export default logger;
