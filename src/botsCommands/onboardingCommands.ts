import { Bot } from 'grammy';
import type { BotContext } from '../types/types.js';
import Database from 'better-sqlite3';
import { getUserById, createOrUpdateUser, deleteUser } from '../storage/userRepository.js';
import logger from '../utils/logger.js';

let db: Database.Database;

/**
 * Initialize onboarding commands
 */
export function registerOnboardingCommands(bot: Bot<BotContext>, database: Database.Database) {
  db = database;

  // /onboarding command
  bot.command('onboarding', async (ctx) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username || 'unknown';

    if (!userId) {
      return;
    }

    // Check user status
    const user = getUserById(db, userId);

    if (user?.onboarding_status === 'STARTED') {
      await ctx.reply(ctx.i18n.t('onboarding-already-started'));

      return;
    }

    if (user?.onboarding_status === 'WAITING_PAYMENT') {
      await ctx.reply(ctx.i18n.t('onboarding-already-waiting'));

      return;
    }

    if (user?.onboarding_status === 'COMPLETED') {
      await ctx.reply(ctx.i18n.t('onboarding-already-completed'));

      return;
    }

    // Create user with STARTED status
    createOrUpdateUser(db, userId, username, 'STARTED');

    // Enter conversation
    await ctx.conversation.enter('onboardingConversation');
  });

  // /cancel command
  bot.command('cancel', async (ctx) => {
    const userId = ctx.from?.id;

    if (!userId) {
      return;
    }

    const user = getUserById(db, userId);

    if (user?.onboarding_status === 'STARTED') {
      deleteUser(db, userId);
      await ctx.conversation.exit('onboardingConversation');
      await ctx.reply(ctx.i18n.t('onboarding-cancelled'));
      logger.info({ userId }, 'Onboarding cancelled by user');
    } else {
      await ctx.reply(ctx.i18n.t('onboarding-nothing-to-cancel'));
    }
  });
}
