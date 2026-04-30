console.log('==========================================');
console.log('APP STARTING - app.ts loaded');
console.log('==========================================');

import './config/environment.js'; // Validates environment on import

console.log('✓ Environment validated');

import { createBot } from './bots/mainBot.js';
import Bree from 'bree';
import { jobs } from './jobs/index.js';
import logger from './utils/logger.js';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';

console.log('✓ All imports loaded');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  logger.fatal({ err }, 'Uncaught Exception');
  setTimeout(() => process.exit(1), 500);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  logger.fatal({ err: reason }, 'Unhandled Rejection');
  setTimeout(() => process.exit(1), 500);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extension = extname(__filename).slice(1);

async function startApp() {
  console.log('✓ startApp() called');
  try {
    console.log('→ Initializing bot...');
    // Initialize bot
    const bot = await createBot();

    console.log('✓ Bot initialized');

    // Initialize job scheduler
    const bree = new Bree({
      jobs: jobs,
      root: join(__dirname, 'jobs'),
      defaultExtension: extension === 'ts' ? 'ts' : 'js',
      workerMessageHandler: (message) => {
        logger.info({ message }, 'Job worker message');
      },
      errorHandler: (error, workerMetadata) => {
        logger.error({ err: error, worker: workerMetadata }, 'Job error');
      },
    });

    // Start job scheduler
    await bree.start();
    logger.info('✅ Job scheduler started');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`);
      await bree.stop();
      if (bot) bot.stop();
      process.exit(0);
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    console.log('✓ App fully started and running!');
  } catch (error) {
    console.error('❌ ERROR starting app:', error);
    logger.error({ err: error }, 'Failed to start application');

    // Give pino a moment to flush its worker thread before exiting
    setTimeout(() => process.exit(1), 500);
  }
}

console.log('→ Calling startApp()...');
startApp();
