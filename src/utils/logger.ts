import winston, { format, transports } from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
    userChat: 7,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'grey',
    debug: 'blue',
    silly: 'rainbow',
    userChat: 'cyan',
  },
};

// Add colors to winston
winston.addColors(customLevels.colors);

const logFormat = format.printf((info) => {
  const { timestamp, level, label, message, ...meta } = info;
  let log = `${timestamp} ${level} [${label}]: ${message}`;

  // Add metadata if it exists
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }

  return log;
});

const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.label({ label: process.env.NODE_ENV || 'development' }),
    format.errors({ stack: true }), // Include stack traces for errors
    format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  ),
  transports: [
    // Console transport with colors
    new transports.Console({
      format: format.combine(format.colorize({ all: true }), logFormat),
    }),

    // General log file
    new transports.File({
      filename: path.join(logsDir, 'app.log'),
      format: format.combine(format.json()),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Error log file
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      format: format.combine(format.json()),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // User chat log file
    new transports.File({
      filename: path.join(logsDir, 'chat.log'),
      format: format.combine(format.json()),
      level: 'userChat',
      maxsize: 10485760, // 10MB for chat logs
      maxFiles: 10,
    }),
  ],

  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 3,
    }),
  ],

  rejectionHandlers: [
    new transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 3,
    }),
  ],

  exitOnError: false,
});

// Development-specific logging
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      level: 'debug',
      format: format.combine(format.colorize(), format.simple()),
    }),
  );
}

// Helper methods for common logging patterns
export const loggers = {
  // User interaction logging
  userChat: (userId: string | number, message: string, metadata?: object | string) => {
    logger.log('userChat', `User ${userId}: ${message}`, metadata);
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
