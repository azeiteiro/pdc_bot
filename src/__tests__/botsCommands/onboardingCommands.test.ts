import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Set env variables BEFORE importing
process.env.GOOGLE_SPREADSHEET_ID = 'test-spreadsheet-id';
process.env.ONBOARDING_SHEET_ID = 'test-sheet-id';
process.env.ADMIN_IDS = '[]';
process.env.GROUP_CHAT_ID = 'test-group-id';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URL = 'http://localhost:8080';

// Mock dependencies to avoid loading Google Auth
jest.unstable_mockModule('../../googleApi/googleAuth.js', () => ({
  getOAuth2Client: jest.fn().mockResolvedValue({ mock: 'auth-client' } as never),
}));

jest.unstable_mockModule('@googleapis/sheets', () => ({
  sheets: jest.fn(),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
  loggers: {
    userChat: jest.fn(),
    sheetsOperation: jest.fn(),
    errorWithContext: jest.fn(),
  },
}));

jest.unstable_mockModule('../../googleApi/googleSheetsApi.js', () => ({
  addOnboardingData: jest.fn(),
}));

import Database from 'better-sqlite3';
import { Bot } from 'grammy';
import { registerOnboardingCommands } from '../../botsCommands/onboardingCommands.js';
import {
  createOrUpdateUser,
  initializeUsersTable,
  getUserById,
} from '../../storage/userRepository.js';
import type { BotContext } from '../../types/types.js';

describe('onboardingCommands', () => {
  let db: Database.Database;
  let bot: Bot<BotContext>;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeUsersTable(db);

    // Mock bot instance
    bot = new Bot('test-token');
  });

  afterEach(() => {
    db.close();
  });

  it('should prevent starting onboarding if already STARTED', () => {
    createOrUpdateUser(db, 123456, 'testuser', 'STARTED');

    const user = getUserById(db, 123456);

    expect(user).toBeDefined();
    expect(user?.onboarding_status).toBe('STARTED');
  });

  it('should prevent starting onboarding if already WAITING_PAYMENT', () => {
    createOrUpdateUser(db, 123456, 'testuser', 'WAITING_PAYMENT');

    const user = getUserById(db, 123456);

    expect(user).toBeDefined();
    expect(user?.onboarding_status).toBe('WAITING_PAYMENT');
  });

  it('should prevent starting onboarding if already COMPLETED', () => {
    createOrUpdateUser(db, 123456, 'testuser', 'COMPLETED');

    const user = getUserById(db, 123456);

    expect(user).toBeDefined();
    expect(user?.onboarding_status).toBe('COMPLETED');
  });

  it('should create user with STARTED status initially', () => {
    createOrUpdateUser(db, 789012, 'newuser', 'STARTED');

    const user = getUserById(db, 789012);

    expect(user).toBeDefined();
    expect(user?.user_id).toBe(789012);
    expect(user?.telegram_username).toBe('newuser');
    expect(user?.onboarding_status).toBe('STARTED');
  });

  it('should handle multiple users with different statuses', () => {
    createOrUpdateUser(db, 111111, 'user1', 'STARTED');
    createOrUpdateUser(db, 222222, 'user2', 'WAITING_PAYMENT');
    createOrUpdateUser(db, 333333, 'user3', 'COMPLETED');

    const user1 = getUserById(db, 111111);
    const user2 = getUserById(db, 222222);
    const user3 = getUserById(db, 333333);

    expect(user1?.onboarding_status).toBe('STARTED');
    expect(user2?.onboarding_status).toBe('WAITING_PAYMENT');
    expect(user3?.onboarding_status).toBe('COMPLETED');
  });

  it('should register bot command without errors', () => {
    expect(() => {
      registerOnboardingCommands(bot, db);
    }).not.toThrow();
  });
});
