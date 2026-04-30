import { Bot } from 'grammy';
import type { BotContext } from '../types/types.js';
import Database from 'better-sqlite3';
import {
  getUserById,
  createOrUpdateUser,
  deleteUser,
  updateUserStatus,
  getPendingUsers,
} from '../storage/userRepository.js';
import logger from '../utils/logger.js';
import { addOnboardingData, type OnboardingData } from '../googleApi/googleSheetsApi.js';

/**
 * Check if user is admin
 */
function isAdmin(userId: number): boolean {
  try {
    const adminIds = JSON.parse(process.env.ADMIN_IDS || '[]') as number[];

    return adminIds.includes(userId);
  } catch (error) {
    logger.error({ err: error }, 'Failed to parse ADMIN_IDS');

    return false;
  }
}

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
      await ctx.reply(ctx.t('onboarding-already-started'));

      return;
    }

    if (user?.onboarding_status === 'WAITING_PAYMENT') {
      await ctx.reply(ctx.t('onboarding-already-waiting'));

      return;
    }

    if (user?.onboarding_status === 'COMPLETED') {
      await ctx.reply(ctx.t('onboarding-already-completed'));

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
      await ctx.reply(ctx.t('onboarding-cancelled'));
      logger.info({ userId }, 'Onboarding cancelled by user');
    } else {
      await ctx.reply(ctx.t('onboarding-nothing-to-cancel'));
    }
  });

  // /pending command (admin only)
  bot.command('pending', async (ctx) => {
    const userId = ctx.from?.id;

    if (!userId || !isAdmin(userId)) {
      await ctx.reply(ctx.t('onboarding-admin-error-unauthorized'));

      return;
    }

    const pendingUsers = getPendingUsers(db);

    if (pendingUsers.length === 0) {
      await ctx.reply(ctx.t('onboarding-admin-pending-empty'));

      return;
    }

    // Separate by status
    const started = pendingUsers.filter((u) => u.onboarding_status === 'STARTED');
    const waitingPayment = pendingUsers.filter((u) => u.onboarding_status === 'WAITING_PAYMENT');

    let message = '';

    if (started.length > 0) {
      message +=
        ctx.t('onboarding-admin-pending-started', { count: String(started.length) }) + '\n';
      started.forEach((u) => {
        message += `- @${u.telegram_username} (ID: ${u.user_id})\n`;
      });
      message += '\n';
    }

    if (waitingPayment.length > 0) {
      message +=
        ctx.t('onboarding-admin-pending-waiting', { count: String(waitingPayment.length) }) + '\n';
      waitingPayment.forEach((u) => {
        message += `- @${u.telegram_username} (ID: ${u.user_id})\n`;
      });
    }

    await ctx.reply(message.trim());
    logger.info({ userId, pendingCount: pendingUsers.length }, 'Admin viewed pending users');
  });

  // /confirm command (admin only)
  bot.command('confirm', async (ctx) => {
    const userId = ctx.from?.id;

    if (!userId || !isAdmin(userId)) {
      await ctx.reply(ctx.t('onboarding-admin-error-unauthorized'));

      return;
    }

    // Parse user_id from command
    const commandText = ctx.message?.text || '';
    const parts = commandText.split(' ');

    if (parts.length !== 2) {
      await ctx.reply(ctx.t('onboarding-admin-error-invalid-id'));

      return;
    }

    const targetUserId = parseInt(parts[1], 10);

    if (isNaN(targetUserId)) {
      await ctx.reply(ctx.t('onboarding-admin-error-invalid-id'));

      return;
    }

    // Check user exists and status
    const user = getUserById(db, targetUserId);

    if (!user) {
      await ctx.reply(ctx.t('onboarding-admin-error-not-found', { userId: String(targetUserId) }));

      return;
    }

    if (user.onboarding_status !== 'WAITING_PAYMENT') {
      await ctx.reply(
        ctx.t('onboarding-admin-error-wrong-status', {
          username: user.telegram_username || 'unknown',
          status: user.onboarding_status || 'unknown',
        }),
      );

      return;
    }

    // Generate single-use invite link
    try {
      const inviteLink = await bot.api.createChatInviteLink(process.env.GROUP_CHAT_ID, {
        member_limit: 1,
        name: `Invite for @${user.telegram_username}`,
      });

      // Send invite to user
      await bot.api.sendMessage(
        targetUserId,
        ctx.t('onboarding-invite-sent', { inviteLink: inviteLink.invite_link }),
      );

      // Update user status to COMPLETED
      updateUserStatus(db, targetUserId, 'COMPLETED');

      // Confirm to admin
      await ctx.reply(
        ctx.t('onboarding-admin-confirm-success', {
          username: user.telegram_username || 'unknown',
          userId: String(targetUserId),
        }),
      );

      logger.info(
        { adminId: userId, targetUserId, inviteLink: inviteLink.invite_link },
        'Payment confirmed and invite sent',
      );
    } catch (error) {
      logger.error(
        { err: error, targetUserId, chatId: process.env.GROUP_CHAT_ID },
        'Failed to create invite link',
      );

      if ((error as Error).message?.includes('chat not found')) {
        await ctx.reply(ctx.t('onboarding-admin-error-config'));
      } else {
        await ctx.reply(ctx.t('onboarding-admin-error-invite-failed'));
      }
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
    await ctx.reply(ctx.t('onboarding-cancelled'));
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

    await ctx.reply(ctx.t('onboarding-payment-instructions', { mbwayNumber }));

    // Notify admin
    const adminIds = JSON.parse(process.env.ADMIN_IDS || '[]') as number[];

    if (adminIds.length > 0) {
      const notification = ctx.t('onboarding-admin-notification', {
        username,
        userId: String(userId),
      });

      await ctx.api.sendMessage(adminIds[0], notification);
      logger.info({ userId, adminId: adminIds[0] }, 'Admin notified of new onboarding submission');
    }

    logger.info({ userId, status: 'WAITING_PAYMENT' }, 'Onboarding completed successfully');
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to save onboarding data');
    await ctx.reply(ctx.t('onboarding-error-save-failed'));

    // Don't update status if save failed
  }
}
