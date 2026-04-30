import { Bot } from 'grammy';
import type { BotContext } from '../types/types.js';
import { generateDailyMessage } from '../utils/utils.js';
import logger from '../utils/logger.js';

export const name = 'dailyMessage';
export const cron = '0 9 * * *'; // 9 AM daily

export async function run(bot?: Bot<BotContext>) {
  try {
    let jobBot = bot;

    if (!jobBot) {
      const token =
        process.env.NODE_ENV === 'production'
          ? process.env.BOT_PRODUCTION_TOKEN
          : process.env.BOT_DEVELOPMENT_TOKEN;

      if (!token) {
        throw new Error('Bot token not found in environment');
      }

      jobBot = new Bot<BotContext>(token);
    }

    const chatId = Number(process.env.GROUP_CHAT_ID);

    if (!chatId) {
      logger.error('GROUP_CHAT_ID environment variable not set');

      return;
    }

    await generateDailyMessage(jobBot, chatId);
    logger.info('Daily message sent successfully');
  } catch (error) {
    logger.error({ err: error }, 'Failed to send daily message');
    throw error;
  }
}

import { isMainThread } from 'node:worker_threads';

// Self-execute if run as a worker
if (!isMainThread) {
  run().catch((err) => {
    logger.error(err);
    process.exit(1);
  });
}
