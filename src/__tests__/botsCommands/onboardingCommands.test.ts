import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type Database from 'better-sqlite3';

// Mock dependencies
jest.unstable_mockModule('../../storage/userRepository.js', () => ({
  getUserById: jest.fn(),
  createOrUpdateUser: jest.fn(),
  deleteUser: jest.fn(),
  updateUserStatus: jest.fn(),
  getPendingUsers: jest.fn(),
}));

jest.unstable_mockModule('../../googleApi/googleSheetsApi.js', () => ({
  addOnboardingData: jest.fn(),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const userRepository = await import('../../storage/userRepository.js');
const { default: logger } = await import('../../utils/logger.js');
const { registerOnboardingCommands } = await import('../../botsCommands/onboardingCommands.js');

import { Bot } from 'grammy';
import type { BotContext } from '../../types/types.js';

describe('onboardingCommands', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockBot: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handlers: Record<string, (...args: any[]) => any> = {};
  let mockDb: Database.Database;

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};
    process.env.ADMIN_IDS = '[123456]';
    process.env.GROUP_CHAT_ID = '-1001234567890';

    mockBot = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: jest.fn((cmd: string, handler: any) => {
        handlers[`command:${cmd}`] = handler;
      }),
      api: {
        createChatInviteLink: jest.fn(),
        sendMessage: jest.fn(),
      },
    } as unknown as Bot<BotContext>;

    mockDb = {} as Database.Database;

    registerOnboardingCommands(mockBot, mockDb);
  });

  const createMockCtx = (userId: number = 123456, username: string = 'testuser') => ({
    from: { id: userId, username, first_name: 'Test', last_name: 'User' },
    chat: { type: 'private' },
    reply: jest.fn(),
    t: jest.fn((key: string) => key),
    conversation: {
      enter: jest.fn(),
      exit: jest.fn(),
    },
    message: { text: '' },
    api: mockBot.api,
  });

  describe('/onboarding command', () => {
    it('should start onboarding for new user', async () => {
      (userRepository.getUserById as jest.Mock).mockReturnValue(null);
      const ctx = createMockCtx();

      await handlers['command:onboarding'](ctx);

      expect(userRepository.createOrUpdateUser).toHaveBeenCalledWith(
        mockDb,
        123456,
        'testuser',
        'STARTED',
        'Test User',
      );
      expect(ctx.conversation.enter).toHaveBeenCalledWith('onboardingConversation');
    });

    it('should prevent duplicate onboarding if already started', async () => {
      (userRepository.getUserById as jest.Mock).mockReturnValue({
        user_id: 123456,
        onboarding_status: 'STARTED',
      });
      const ctx = createMockCtx();

      await handlers['command:onboarding'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('onboarding-already-started');
      expect(ctx.conversation.enter).not.toHaveBeenCalled();
    });

    it('should prevent duplicate onboarding if waiting payment', async () => {
      (userRepository.getUserById as jest.Mock).mockReturnValue({
        user_id: 123456,
        onboarding_status: 'WAITING_PAYMENT',
      });
      const ctx = createMockCtx();

      await handlers['command:onboarding'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('onboarding-already-waiting');
      expect(ctx.conversation.enter).not.toHaveBeenCalled();
    });

    it('should prevent duplicate onboarding if completed', async () => {
      (userRepository.getUserById as jest.Mock).mockReturnValue({
        user_id: 123456,
        onboarding_status: 'COMPLETED',
      });
      const ctx = createMockCtx();

      await handlers['command:onboarding'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('onboarding-already-completed');
      expect(ctx.conversation.enter).not.toHaveBeenCalled();
    });
  });

  describe('/cancel command', () => {
    it('should cancel onboarding if user has started', async () => {
      (userRepository.getUserById as jest.Mock).mockReturnValue({
        user_id: 123456,
        onboarding_status: 'STARTED',
      });
      const ctx = createMockCtx();

      await handlers['command:cancel'](ctx);

      expect(userRepository.deleteUser).toHaveBeenCalledWith(mockDb, 123456);
      expect(ctx.conversation.exit).toHaveBeenCalledWith('onboardingConversation');
      expect(ctx.reply).toHaveBeenCalledWith('onboarding-cancelled');
    });

    it('should inform user if nothing to cancel', async () => {
      (userRepository.getUserById as jest.Mock).mockReturnValue({
        user_id: 123456,
        onboarding_status: 'COMPLETED',
      });
      const ctx = createMockCtx();

      await handlers['command:cancel'](ctx);

      expect(userRepository.deleteUser).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith('onboarding-nothing-to-cancel');
    });
  });

  describe('/pending command', () => {
    it('should show pending users to admin', async () => {
      (userRepository.getPendingUsers as jest.Mock).mockReturnValue([
        { user_id: 111, telegram_username: 'user1', onboarding_status: 'STARTED' },
        { user_id: 222, telegram_username: 'user2', onboarding_status: 'WAITING_PAYMENT' },
      ]);
      const ctx = createMockCtx(123456);

      await handlers['command:pending'](ctx);

      expect(ctx.reply).toHaveBeenCalled();
    });

    it('should show empty message if no pending users', async () => {
      (userRepository.getPendingUsers as jest.Mock).mockReturnValue([]);
      const ctx = createMockCtx(123456);

      await handlers['command:pending'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('onboarding-admin-pending-empty');
    });

    it('should reject non-admin users', async () => {
      const ctx = createMockCtx(999999);

      await handlers['command:pending'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('onboarding-admin-error-unauthorized');
      expect(userRepository.getPendingUsers).not.toHaveBeenCalled();
    });
  });

  describe('/confirm command', () => {
    beforeEach(() => {
      (mockBot.api.createChatInviteLink as jest.Mock).mockResolvedValue({
        invite_link: 'https://t.me/+abc123',
      });
      (mockBot.api.sendMessage as jest.Mock).mockResolvedValue({});
    });

    it('should confirm payment and send invite link', async () => {
      (userRepository.getUserById as jest.Mock).mockReturnValue({
        user_id: 789,
        telegram_username: 'newuser',
        onboarding_status: 'WAITING_PAYMENT',
      });
      const ctx = createMockCtx(123456);

      ctx.message.text = '/confirm 789';

      await handlers['command:confirm'](ctx);

      expect(mockBot.api.createChatInviteLink).toHaveBeenCalledWith('-1001234567890', {
        member_limit: 1,
        name: 'Invite for @newuser',
      });
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(789, expect.any(String));
      expect(userRepository.updateUserStatus).toHaveBeenCalledWith(mockDb, 789, 'COMPLETED');
    });

    it('should reject non-admin users', async () => {
      const ctx = createMockCtx(999999);

      ctx.message.text = '/confirm 789';

      await handlers['command:confirm'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('onboarding-admin-error-unauthorized');
      expect(mockBot.api.createChatInviteLink).not.toHaveBeenCalled();
    });

    it('should reject invalid user ID format', async () => {
      const ctx = createMockCtx(123456);

      ctx.message.text = '/confirm invalid';

      await handlers['command:confirm'](ctx);

      expect(ctx.reply).toHaveBeenCalledWith('onboarding-admin-error-invalid-id');
    });

    it('should reject if user not found', async () => {
      (userRepository.getUserById as jest.Mock).mockReturnValue(null);
      const ctx = createMockCtx(123456);

      ctx.message.text = '/confirm 789';

      await handlers['command:confirm'](ctx);

      expect(ctx.reply).toHaveBeenCalled();
      expect(mockBot.api.createChatInviteLink).not.toHaveBeenCalled();
    });

    it('should reject if user not waiting payment', async () => {
      (userRepository.getUserById as jest.Mock).mockReturnValue({
        user_id: 789,
        telegram_username: 'user',
        onboarding_status: 'STARTED',
      });
      const ctx = createMockCtx(123456);

      ctx.message.text = '/confirm 789';

      await handlers['command:confirm'](ctx);

      expect(ctx.reply).toHaveBeenCalled();
      expect(mockBot.api.createChatInviteLink).not.toHaveBeenCalled();
    });

    it('should handle invite link creation errors', async () => {
      (userRepository.getUserById as jest.Mock).mockReturnValue({
        user_id: 789,
        telegram_username: 'user',
        onboarding_status: 'WAITING_PAYMENT',
      });
      (mockBot.api.createChatInviteLink as jest.Mock).mockRejectedValue(
        new Error('chat not found'),
      );
      const ctx = createMockCtx(123456);

      ctx.message.text = '/confirm 789';

      await handlers['command:confirm'](ctx);

      expect(logger.error).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalled();
      expect(userRepository.updateUserStatus).not.toHaveBeenCalled();
    });
  });
});
