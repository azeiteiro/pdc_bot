import { Bot } from 'grammy';
import type { BotContext } from '../types/types.js';
import Database from 'better-sqlite3';
import {
  getUserById,
  createOrUpdateUser,
  deleteUser,
  updateUserStatus,
} from '../storage/userRepository.js';
import logger from '../utils/logger.js';
import { addOnboardingData, type OnboardingData } from '../googleApi/googleSheetsApi.js';

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

/**
 * Handle conversation completion
 * Called after onboardingConversation returns
 */
export async function handleOnboardingComplete(
  ctx: BotContext,
  result: { cancelled: boolean; data: OnboardingData | null },
) {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'unknown';

  if (!userId) {
    return;
  }

  if (result.cancelled) {
    // User cancelled during summary
    deleteUser(db, userId);
    await ctx.reply(ctx.i18n.t('onboarding-cancelled'));
    logger.info({ userId }, 'Onboarding cancelled by user at summary');

    return;
  }

  if (!result.data) {
    logger.error({ userId }, 'Onboarding data is null but not cancelled');

    return;
  }

  // Save to Google Sheets
  const sheetData: OnboardingData = {
    nome: result.data.nome,
    dataChegada: result.data.dataChegada,
    dataPartida: result.data.dataPartida,
    levaCarro: result.data.levaCarro,
    localPartida: result.data.localPartida,
    tendaEntregue: 'Não',
    observacoes: result.data.observacoes,
  };

  try {
    await addOnboardingData(sheetData);

    // Update user status to WAITING_PAYMENT
    updateUserStatus(db, userId, 'WAITING_PAYMENT');

    // Show payment instructions
    const mbwayNumber = '+351 XXX XXX XXX'; // TODO: Get from config or i18n

    await ctx.reply(ctx.i18n.t('onboarding-payment-instructions', { mbwayNumber }));

    // Notify admin
    const adminIds = JSON.parse(process.env.ADMIN_IDS || '[]') as number[];

    if (adminIds.length > 0) {
      const notification = ctx.i18n.t('onboarding-admin-notification', {
        username,
        userId: String(userId),
      });

      await ctx.api.sendMessage(adminIds[0], notification);
      logger.info({ userId, adminId: adminIds[0] }, 'Admin notified of new onboarding submission');
    }

    logger.info({ userId, status: 'WAITING_PAYMENT' }, 'Onboarding completed successfully');
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to save onboarding data');
    await ctx.reply(ctx.i18n.t('onboarding-error-save-failed'));

    // Don't update status if save failed
  }
}
