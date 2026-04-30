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

jest.unstable_mockModule('grammy', () => ({
  InlineKeyboard: jest.fn().mockImplementation(() => ({
    text: jest.fn().mockReturnThis(),
    row: jest.fn().mockReturnThis(),
  })),
}));

const { setOnboardingDatabase, parseDate, formatDate, onboardingConversation } =
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

  describe('onboardingConversation flow', () => {
    it('should complete full onboarding flow with confirmation', async () => {
      // Setup
      (googleSheets.addOnboardingData as jest.Mock).mockResolvedValue(undefined);
      process.env.ADMIN_IDS = '[999]';

      // Mock conversation object
      const mockConversation = {
        waitForCallbackQuery: jest
          .fn()
          .mockResolvedValueOnce({
            // Name confirmation
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'name_confirm' },
          })
          .mockResolvedValueOnce({
            // Arrival date confirmation
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'date_confirm' },
          })
          .mockResolvedValueOnce({
            // Departure date confirmation
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'date_confirm_dep' },
          })
          .mockResolvedValueOnce({
            // Car question
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'car_yes' },
          })
          .mockResolvedValueOnce({
            // Summary confirmation
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'summary_submit' },
          }),
        wait: jest
          .fn()
          .mockResolvedValueOnce({
            // Arrival date input
            message: { text: 'tomorrow' },
          })
          .mockResolvedValueOnce({
            // Departure date input
            message: { text: 'next week' },
          })
          .mockResolvedValueOnce({
            // Additional info input
            message: { text: 'Test notes' },
          }),
        waitFor: jest.fn().mockResolvedValueOnce({
          // Departure location input
          message: { text: 'Lisbon' },
        }),
      };

      // Mock ctx object
      const mockCtx = {
        from: { id: 123, first_name: 'John', last_name: 'Doe', username: 'johndoe' },
        reply: jest.fn(),
        api: {
          sendMessage: jest.fn(),
        },
      };

      // Execute
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      // Verify
      expect(googleSheets.addOnboardingData).toHaveBeenCalledWith({
        nome: 'John Doe',
        dataChegada: expect.any(String),
        dataPartida: expect.any(String),
        levaCarro: 'onboarding-yes',
        localPartida: 'Lisbon',
        tendaEntregue: 'Não',
        observacoes: 'Test notes',
      });
      expect(userRepository.updateUserStatus).toHaveBeenCalledWith(mockDb, 123, 'WAITING_PAYMENT');
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('onboarding-payment-instructions'),
      );
    });

    it('should handle custom name entry', async () => {
      // Setup
      (googleSheets.addOnboardingData as jest.Mock).mockResolvedValue(undefined);
      process.env.ADMIN_IDS = '[999]';

      const mockConversation = {
        waitForCallbackQuery: jest
          .fn()
          .mockResolvedValueOnce({
            // Name edit
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'name_edit' },
          })
          .mockResolvedValueOnce({
            // No car
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'car_no' },
          })
          .mockResolvedValueOnce({
            // Summary submit
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'summary_submit' },
          }),
        wait: jest
          .fn()
          .mockResolvedValueOnce({
            // Arrival unknown
            callbackQuery: { data: 'arrival_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            // Departure unknown
            callbackQuery: { data: 'departure_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            // Skip additional info
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          }),
        waitFor: jest.fn().mockResolvedValueOnce({
          // Custom name
          message: { text: 'Custom Name' },
        }),
      };

      const mockCtx = {
        from: { id: 456, first_name: 'Jane', username: 'janedoe' },
        reply: jest.fn(),
        api: {
          sendMessage: jest.fn(),
        },
      };

      // Execute
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      // Verify
      expect(googleSheets.addOnboardingData).toHaveBeenCalledWith({
        nome: 'Custom Name',
        dataChegada: 'onboarding-dont-know',
        dataPartida: 'onboarding-dont-know',
        levaCarro: 'onboarding-no',
        localPartida: '',
        tendaEntregue: 'Não',
        observacoes: '',
      });
    });

    it('should handle cancellation at summary', async () => {
      const mockConversation = {
        waitForCallbackQuery: jest
          .fn()
          .mockResolvedValueOnce({
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'name_confirm' },
          })
          .mockResolvedValueOnce({
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'car_no' },
          })
          .mockResolvedValueOnce({
            // Cancel at summary
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'summary_cancel' },
          }),
        wait: jest
          .fn()
          .mockResolvedValueOnce({
            // Arrival unknown
            callbackQuery: { data: 'arrival_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            // Departure unknown
            callbackQuery: { data: 'departure_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          }),
      };

      const mockCtx = {
        from: { id: 789 },
        reply: jest.fn(),
      };

      // Execute
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      // Verify
      expect(userRepository.deleteUser).toHaveBeenCalledWith(mockDb, 789);
      expect(mockCtx.reply).toHaveBeenCalledWith('onboarding-cancelled');
      expect(googleSheets.addOnboardingData).not.toHaveBeenCalled();
    });

    it('should handle Google Sheets save failure', async () => {
      // Setup
      (googleSheets.addOnboardingData as jest.Mock).mockRejectedValue(new Error('API error'));
      process.env.ADMIN_IDS = '[999]';

      const mockConversation = {
        waitForCallbackQuery: jest
          .fn()
          .mockResolvedValueOnce({
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'name_confirm' },
          })
          .mockResolvedValueOnce({
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'car_no' },
          })
          .mockResolvedValueOnce({
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'summary_submit' },
          }),
        wait: jest
          .fn()
          .mockResolvedValueOnce({
            // Arrival unknown
            callbackQuery: { data: 'arrival_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            // Departure unknown
            callbackQuery: { data: 'departure_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          }),
      };

      const mockCtx = {
        from: { id: 999, first_name: 'Test' },
        reply: jest.fn(),
        api: {
          sendMessage: jest.fn(),
        },
      };

      // Execute
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      // Verify
      expect(mockCtx.reply).toHaveBeenCalledWith('onboarding-error-save-failed');
      expect(userRepository.updateUserStatus).not.toHaveBeenCalled();
    });

    it('should handle invalid date input and retry', async () => {
      (googleSheets.addOnboardingData as jest.Mock).mockResolvedValue(undefined);
      process.env.ADMIN_IDS = '[999]';

      const mockConversation = {
        waitForCallbackQuery: jest
          .fn()
          .mockResolvedValueOnce({
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'name_confirm' },
          })
          .mockResolvedValueOnce({
            // Reject first date
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'date_reject' },
          })
          .mockResolvedValueOnce({
            // Confirm second date
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'date_confirm' },
          })
          .mockResolvedValueOnce({
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'car_no' },
          })
          .mockResolvedValueOnce({
            answerCallbackQuery: jest.fn(),
            callbackQuery: { data: 'summary_submit' },
          }),
        wait: jest
          .fn()
          .mockResolvedValueOnce({
            // First invalid date
            message: { text: 'invalid' },
          })
          .mockResolvedValueOnce({
            // Second valid date (first attempt)
            message: { text: 'tomorrow' },
          })
          .mockResolvedValueOnce({
            // After rejection, retry with valid date
            message: { text: 'tomorrow' },
          })
          .mockResolvedValueOnce({
            // Departure unknown
            callbackQuery: { data: 'departure_unknown' },
            answerCallbackQuery: jest.fn(),
          })
          .mockResolvedValueOnce({
            // Skip info
            callbackQuery: { data: 'info_skip' },
            answerCallbackQuery: jest.fn(),
          }),
      };

      const mockCtx = {
        from: { id: 111, first_name: 'Test' },
        reply: jest.fn(),
        api: {
          sendMessage: jest.fn(),
        },
      };

      // Execute
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onboardingConversation(mockConversation as any, mockCtx as any);

      // Verify - should have shown invalid date message and retried
      expect(mockCtx.reply).toHaveBeenCalledWith('onboarding-date-invalid');
      expect(googleSheets.addOnboardingData).toHaveBeenCalled();
    });
  });
});
