import winston, { format, transports } from 'winston';

const customLevels = {
  levels: {
    ...winston.config.npm.levels,
    userChat: 7,
  },
  colors: {
    ...winston.config.npm.colors,
    userChat: 'green',
  },
};

const logFormat = format.printf(
  (info) => `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`,
);

const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.label({ label: 'output' }),
    // Format the metadata object
    format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), logFormat),
    }),
    new transports.File({
      filename: 'logs/logger.log',
      format: format.combine(format.json()),
    }),
    new transports.File({
      filename: 'logs/error.log',
      format: format.combine(format.json()),
      level: 'error',
    }),
    new transports.File({
      filename: 'logs/chat.log',
      format: format.combine(format.json()),
      level: 'userChat',
    }),
  ],
  exitOnError: false,
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.simple(),
    }),
  );
}

export default logger;
