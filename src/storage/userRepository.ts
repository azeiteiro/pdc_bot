import type Database from 'better-sqlite3';
import logger from '../utils/logger.js';
import type { User } from '../types/types.js';

/**
 * Initialize the users table in the database
 */
export function initializeUsersTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      telegram_username TEXT,
      name TEXT,
      preferred_language TEXT,
      onboarding_status TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrate existing tables that predate the name column
  try {
    db.exec('ALTER TABLE users ADD COLUMN name TEXT');
  } catch {
    // Column already exists — nothing to do
  }

  logger.info('Users table initialized');
}

/**
 * Create or update a user record
 */
export function createOrUpdateUser(
  db: Database.Database,
  userId: number,
  username: string | null,
  status: string,
  name?: string,
): void {
  const stmt = db.prepare(`
    INSERT INTO users (user_id, telegram_username, name, onboarding_status, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      telegram_username = excluded.telegram_username,
      name = excluded.name,
      onboarding_status = excluded.onboarding_status,
      updated_at = CURRENT_TIMESTAMP
  `);

  try {
    stmt.run(userId, username, name ?? null, status);
    logger.info({ userId, status }, 'User created/updated');
  } catch (error) {
    logger.error(
      { err: error, userId, operation: 'createOrUpdateUser' },
      'Database operation failed',
    );
    throw error;
  }
}

/**
 * Get user by ID
 */
export function getUserById(db: Database.Database, userId: number): User | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE user_id = ?');

  try {
    return stmt.get(userId) as User | undefined;
  } catch (error) {
    logger.error({ err: error, userId, operation: 'getUserById' }, 'Database query failed');

    return undefined;
  }
}

/**
 * Delete user record
 */
export function deleteUser(db: Database.Database, userId: number): void {
  const stmt = db.prepare('DELETE FROM users WHERE user_id = ?');

  try {
    stmt.run(userId);
    logger.info({ userId }, 'User deleted');
  } catch (error) {
    logger.error({ err: error, userId, operation: 'deleteUser' }, 'Database operation failed');
    throw error;
  }
}

/**
 * Get all users with STARTED or WAITING_PAYMENT status
 */
export function getPendingUsers(db: Database.Database): User[] {
  const stmt = db.prepare(`
    SELECT * FROM users
    WHERE onboarding_status IN ('STARTED', 'WAITING_PAYMENT')
    ORDER BY updated_at DESC
  `);

  try {
    return stmt.all() as User[];
  } catch (error) {
    logger.error({ err: error, operation: 'getPendingUsers' }, 'Database query failed');

    return [];
  }
}

/**
 * Update user status only
 */
export function updateUserStatus(db: Database.Database, userId: number, status: string): void {
  const stmt = db.prepare(`
    UPDATE users
    SET onboarding_status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `);

  try {
    stmt.run(status, userId);
    logger.info({ userId, status }, 'User status updated');
  } catch (error) {
    logger.error(
      { err: error, userId, operation: 'updateUserStatus' },
      'Database operation failed',
    );
    throw error;
  }
}
