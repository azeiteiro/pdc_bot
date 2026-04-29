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

  // Cache prepared statements once at initialization
  const selectStmt = db.prepare('SELECT value FROM sessions WHERE key = ?');
  const upsertStmt = db.prepare('INSERT OR REPLACE INTO sessions (key, value) VALUES (?, ?)');
  const deleteStmt = db.prepare('DELETE FROM sessions WHERE key = ?');

  return {
    read: (key: string): T | undefined => {
      const row = selectStmt.get(key) as { value: string } | undefined;

      if (!row) return undefined;

      try {
        return JSON.parse(row.value);
      } catch (error) {
        console.error(`Failed to parse JSON for key "${key}":`, error);

        return undefined;
      }
    },

    write: (key: string, value: T): void => {
      upsertStmt.run(key, JSON.stringify(value));
    },

    delete: (key: string): void => {
      deleteStmt.run(key);
    },
  };
};
