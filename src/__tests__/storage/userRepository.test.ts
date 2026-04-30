import Database from 'better-sqlite3';
import {
  createOrUpdateUser,
  getUserById,
  deleteUser,
  getPendingUsers,
  updateUserStatus,
  initializeUsersTable,
} from '../../storage/userRepository.js';

describe('userRepository', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeUsersTable(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('createOrUpdateUser', () => {
    it('should create a new user', () => {
      createOrUpdateUser(db, 123456, 'testuser', 'STARTED');

      const user = getUserById(db, 123456);

      expect(user).toBeDefined();
      expect(user?.user_id).toBe(123456);
      expect(user?.telegram_username).toBe('testuser');
      expect(user?.onboarding_status).toBe('STARTED');
    });

    it('should update existing user status', () => {
      createOrUpdateUser(db, 123456, 'testuser', 'STARTED');
      createOrUpdateUser(db, 123456, 'testuser', 'WAITING_PAYMENT');

      const user = getUserById(db, 123456);

      expect(user?.onboarding_status).toBe('WAITING_PAYMENT');
    });
  });

  describe('getUserById', () => {
    it('should return user if exists', () => {
      createOrUpdateUser(db, 123456, 'testuser', 'STARTED');

      const user = getUserById(db, 123456);

      expect(user).toBeDefined();
      expect(user?.user_id).toBe(123456);
    });

    it('should return undefined if user does not exist', () => {
      const user = getUserById(db, 999999);

      expect(user).toBeUndefined();
    });
  });

  describe('deleteUser', () => {
    it('should delete user', () => {
      createOrUpdateUser(db, 123456, 'testuser', 'STARTED');
      deleteUser(db, 123456);

      const user = getUserById(db, 123456);

      expect(user).toBeUndefined();
    });
  });

  describe('getPendingUsers', () => {
    it('should return users with STARTED status', () => {
      createOrUpdateUser(db, 111111, 'user1', 'STARTED');
      createOrUpdateUser(db, 222222, 'user2', 'COMPLETED');
      createOrUpdateUser(db, 333333, 'user3', 'WAITING_PAYMENT');

      const pending = getPendingUsers(db);

      expect(pending).toHaveLength(2);
      expect(pending.map((u) => u.user_id)).toContain(111111);
      expect(pending.map((u) => u.user_id)).toContain(333333);
      expect(pending.map((u) => u.user_id)).not.toContain(222222);
    });

    it('should return empty array if no pending users', () => {
      createOrUpdateUser(db, 123456, 'user1', 'COMPLETED');

      const pending = getPendingUsers(db);

      expect(pending).toHaveLength(0);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status', () => {
      createOrUpdateUser(db, 123456, 'testuser', 'STARTED');
      updateUserStatus(db, 123456, 'WAITING_PAYMENT');

      const user = getUserById(db, 123456);

      expect(user?.onboarding_status).toBe('WAITING_PAYMENT');
    });
  });

  describe('initializeUsersTable', () => {
    it('should create users table', () => {
      const testDb = new Database(':memory:');

      initializeUsersTable(testDb);

      const tableExists = testDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        .get();

      expect(tableExists).toBeDefined();
      testDb.close();
    });
  });
});
