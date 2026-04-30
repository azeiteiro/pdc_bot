import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type Database from 'better-sqlite3';

// Mock dependencies
jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
  loggers: {
    userChat: jest.fn(),
  },
}));

jest.unstable_mockModule('../../storage/userRepository.js', () => ({
  deleteUser: jest.fn(),
  updateUserStatus: jest.fn(),
}));

jest.unstable_mockModule('../../googleApi/googleSheetsApi.js', () => ({
  addOnboardingData: jest.fn(),
}));

jest.unstable_mockModule('../../config/i18n.js', () => ({
  i18n: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    translate: jest.fn((locale: string, key: string, vars?: any) => {
      if (vars) {
        let result = key;

        Object.keys(vars).forEach((k) => {
          result = result.replace(`{$${k}}`, vars[k]);
        });

        return result;
      }

      return key;
    }),
  },
  getUserLocaleFromCache: jest.fn().mockReturnValue('en'),
}));

const { setOnboardingDatabase, parseDate, formatDate } =
  await import('../../conversations/onboardingConversation.js');
const googleSheets = await import('../../googleApi/googleSheetsApi.js');
const userRepository = await import('../../storage/userRepository.js');

describe('onboardingConversation', () => {
  let mockDb: Database.Database;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {} as Database.Database;
    setOnboardingDatabase(mockDb);
    process.env.ADMIN_IDS = '[123456]';
  });

  describe('setOnboardingDatabase', () => {
    it('should set database instance', () => {
      const testDb = {} as Database.Database;

      expect(() => setOnboardingDatabase(testDb)).not.toThrow();
    });
  });

  describe('parseDate', () => {
    it('should parse English date strings', () => {
      const result = parseDate('tomorrow', 'en');

      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeGreaterThan(new Date().getTime());
    });

    it('should parse Portuguese date strings', () => {
      const result = parseDate('amanhã', 'pt');

      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeGreaterThan(new Date().getTime());
    });

    it('should parse specific date formats in English', () => {
      const result = parseDate('15/05/2026', 'en');

      expect(result).toBeInstanceOf(Date);
      expect(result!.getDate()).toBe(15);
      expect(result!.getMonth()).toBe(4); // May is month 4 (0-indexed)
      expect(result!.getFullYear()).toBe(2026);
    });

    it('should parse specific date formats in Portuguese', () => {
      const result = parseDate('15/05/2026', 'pt');

      expect(result).toBeInstanceOf(Date);
      expect(result!.getDate()).toBe(15);
      expect(result!.getMonth()).toBe(4);
      expect(result!.getFullYear()).toBe(2026);
    });

    it('should return null for invalid date strings', () => {
      const result = parseDate('invalid date', 'en');

      expect(result).toBeNull();
    });

    it('should return null for empty strings', () => {
      const result = parseDate('', 'en');

      expect(result).toBeNull();
    });

    it('should parse relative dates in English', () => {
      const result = parseDate('next Friday', 'en');

      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeGreaterThan(new Date().getTime());
    });

    it('should parse relative dates in Portuguese', () => {
      const result = parseDate('próxima sexta', 'pt');

      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeGreaterThan(new Date().getTime());
    });
  });

  describe('formatDate', () => {
    it('should format date to DD/MM/YYYY', () => {
      const date = new Date(2026, 4, 15); // May 15, 2026

      const result = formatDate(date);

      expect(result).toBe('15/05/2026');
    });

    it('should pad single digit days and months', () => {
      const date = new Date(2026, 0, 5); // January 5, 2026

      const result = formatDate(date);

      expect(result).toBe('05/01/2026');
    });

    it('should handle last day of month', () => {
      const date = new Date(2026, 11, 31); // December 31, 2026

      const result = formatDate(date);

      expect(result).toBe('31/12/2026');
    });

    it('should handle first day of year', () => {
      const date = new Date(2026, 0, 1); // January 1, 2026

      const result = formatDate(date);

      expect(result).toBe('01/01/2026');
    });

    it('should handle leap year dates', () => {
      const date = new Date(2024, 1, 29); // February 29, 2024 (leap year)

      const result = formatDate(date);

      expect(result).toBe('29/02/2024');
    });
  });

  describe('data submission', () => {
    it('should call addOnboardingData on successful submission', async () => {
      (googleSheets.addOnboardingData as jest.Mock).mockResolvedValue(undefined);

      const testData = {
        nome: 'Test User',
        dataChegada: '15/05/2026',
        dataPartida: '20/05/2026',
        levaCarro: 'Yes',
        localPartida: 'Lisbon',
        tendaEntregue: 'Não' as const,
        observacoes: 'Test notes',
      };

      await googleSheets.addOnboardingData(testData);

      expect(googleSheets.addOnboardingData).toHaveBeenCalledWith(testData);
    });

    it('should handle Google Sheets errors gracefully', async () => {
      (googleSheets.addOnboardingData as jest.Mock).mockRejectedValue(
        new Error('Sheets API error'),
      );

      await expect(
        googleSheets.addOnboardingData({
          nome: 'Test',
          dataChegada: '15/05/2026',
          dataPartida: '20/05/2026',
          levaCarro: 'Yes',
          localPartida: 'Lisbon',
          tendaEntregue: 'Não',
          observacoes: '',
        }),
      ).rejects.toThrow('Sheets API error');
    });
  });

  describe('user status management', () => {
    it('should update user status to WAITING_PAYMENT on success', () => {
      userRepository.updateUserStatus(mockDb, 123, 'WAITING_PAYMENT');

      expect(userRepository.updateUserStatus).toHaveBeenCalledWith(mockDb, 123, 'WAITING_PAYMENT');
    });

    it('should delete user on cancellation', () => {
      userRepository.deleteUser(mockDb, 123);

      expect(userRepository.deleteUser).toHaveBeenCalledWith(mockDb, 123);
    });
  });
});
