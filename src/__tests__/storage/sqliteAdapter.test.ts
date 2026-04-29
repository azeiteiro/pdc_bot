import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Create a mock Database class that mimics better-sqlite3 behavior
class MockDatabase {
  private tables: Map<string, Map<string, string>> = new Map();
  private isClosed = false;

  exec(sql: string): void {
    if (this.isClosed) throw new Error('Database is closed');
    if (sql.includes('CREATE TABLE IF NOT EXISTS sessions')) {
      if (!this.tables.has('sessions')) {
        this.tables.set('sessions', new Map());
      }
    }
  }

  prepare(sql: string) {
    if (this.isClosed) throw new Error('Database is closed');

    return {
      get: (key?: string) => {
        if (sql.includes('SELECT name FROM sqlite_master')) {
          return this.tables.has('sessions') ? { name: 'sessions' } : undefined;
        }
        if (sql.includes('SELECT value FROM sessions') && key) {
          const sessionsTable = this.tables.get('sessions');

          if (sessionsTable) {
            const value = sessionsTable.get(key);

            return value ? { value } : undefined;
          }

          return undefined;
        }

        return undefined;
      },
      all: () => {
        if (sql.includes("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")) {
          return this.tables.has('sessions') ? [{ name: 'sessions' }] : [];
        }

        return [];
      },
      run: (key?: string, value?: string) => {
        if (sql.includes('INSERT OR REPLACE') && key && value) {
          const sessionsTable = this.tables.get('sessions') || new Map();

          sessionsTable.set(key, value);
          this.tables.set('sessions', sessionsTable);
        } else if (sql.includes('DELETE FROM sessions') && key) {
          const sessionsTable = this.tables.get('sessions');

          if (sessionsTable) {
            sessionsTable.delete(key);
          }
        }
      },
    };
  }

  close(): void {
    this.isClosed = true;
  }
}

// Mock better-sqlite3
jest.unstable_mockModule('better-sqlite3', () => ({
  default: jest.fn(() => new MockDatabase()),
}));

// Import after mocking
const { createSqliteStorage } = await import('../../storage/sqliteAdapter.js');
const { default: Database } = await import('better-sqlite3');

describe('SQLite Storage Adapter', () => {
  let db: InstanceType<typeof MockDatabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    db = new Database(':memory:');
  });

  afterEach(() => {
    if (db && db.close) {
      db.close();
    }
  });

  describe('createSqliteStorage', () => {
    it('should create sessions table on initialization', () => {
      createSqliteStorage(db);

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
        .all();

      expect(tables).toHaveLength(1);
      expect(tables[0]).toEqual({ name: 'sessions' });
    });

    it('should return storage adapter with read, write, delete methods', () => {
      const storage = createSqliteStorage(db);

      expect(storage).toHaveProperty('read');
      expect(storage).toHaveProperty('write');
      expect(storage).toHaveProperty('delete');
      expect(typeof storage.read).toBe('function');
      expect(typeof storage.write).toBe('function');
      expect(typeof storage.delete).toBe('function');
    });
  });

  describe('read', () => {
    it('should return undefined for non-existent key', () => {
      const storage = createSqliteStorage(db);

      const result = storage.read('non-existent');

      expect(result).toBeUndefined();
    });

    it('should return stored value for existing key', () => {
      const storage = createSqliteStorage(db);
      const testData = { foo: 'bar', count: 42 };

      // Use the storage.write() method instead of direct db.prepare()
      storage.write('test-key', testData);

      const result = storage.read('test-key');

      expect(result).toEqual(testData);
    });

    it('should return undefined when JSON parsing fails', () => {
      const storage = createSqliteStorage(db);

      // Manually insert invalid JSON directly to database
      db.prepare('INSERT OR REPLACE INTO sessions (key, value) VALUES (?, ?)').run(
        'corrupted-key',
        'invalid-json-{not-closed',
      );

      const result = storage.read('corrupted-key');

      expect(result).toBeUndefined();
    });
  });

  describe('write', () => {
    it('should store value for new key', () => {
      const storage = createSqliteStorage(db);
      const testData = { language: 'en' };

      storage.write('user-123', testData);

      const row = db.prepare('SELECT value FROM sessions WHERE key = ?').get('user-123') as {
        value: string;
      };

      expect(JSON.parse(row.value)).toEqual(testData);
    });

    it('should replace value for existing key', () => {
      const storage = createSqliteStorage(db);

      storage.write('user-123', { language: 'en' });
      storage.write('user-123', { language: 'pt' });

      const row = db.prepare('SELECT value FROM sessions WHERE key = ?').get('user-123') as {
        value: string;
      };

      expect(JSON.parse(row.value)).toEqual({ language: 'pt' });
    });
  });

  describe('delete', () => {
    it('should delete existing key', () => {
      const storage = createSqliteStorage(db);

      storage.write('user-123', { language: 'en' });
      storage.delete('user-123');

      const result = storage.read('user-123');

      expect(result).toBeUndefined();
    });

    it('should not throw when deleting non-existent key', () => {
      const storage = createSqliteStorage(db);

      expect(() => storage.delete('non-existent')).not.toThrow();
    });
  });
});
