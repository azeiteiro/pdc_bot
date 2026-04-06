import './config/environment.js'; // Validates environment on import
import { createBot } from './bots/mainBot.js';
import Bree from 'bree';
import { jobs } from './jobs/index.js';
import logger from './utils/logger.js';

async function startApp() {
  try {
    // Initialize bot
    const bot = await createBot();

    // Initialize job scheduler
    const bree = new Bree({
      jobs: jobs,
      root: false,
      defaultExtension: 'js',
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
  } catch (error) {
    logger.error({ err: error }, 'Failed to start application');
    process.exit(1);
  }
}

startApp();
