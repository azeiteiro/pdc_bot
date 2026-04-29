import type Database from 'better-sqlite3';

export interface StorageAdapter<T> {
  read: (key: string) => T | undefined;
  write: (key: string, value: T) => void;
  delete: (key: string) => void;
}

export const createSqliteStorage = <T>(db: Database.Database): StorageAdapter<T> => {
  // Create sessions table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  return {
    read: (key: string): T | undefined => {
      const row = db.prepare('SELECT value FROM sessions WHERE key = ?').get(key) as
        | { value: string }
        | undefined;

      return row ? JSON.parse(row.value) : undefined;
    },

    write: (key: string, value: T): void => {
      db.prepare('INSERT OR REPLACE INTO sessions (key, value) VALUES (?, ?)').run(
        key,
        JSON.stringify(value),
      );
    },

    delete: (key: string): void => {
      db.prepare('DELETE FROM sessions WHERE key = ?').run(key);
    },
  };
};
