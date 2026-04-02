import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// Set env variable BEFORE importing
process.env.GOOGLE_SPREADSHEET_ID = 'test-spreadsheet-id';

// Mock dependencies
jest.unstable_mockModule('@googleapis/sheets', () => ({
  sheets: jest.fn(),
}));

jest.unstable_mockModule('../../googleApi/googleAuth.js', () => ({
  getOAuth2Client: jest.fn().mockResolvedValue({ mock: 'auth-client' } as never),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  loggers: {
    errorWithContext: jest.fn(),
  },
}));

// Load mocked modules
const { sheets } = await import('@googleapis/sheets');
const { loggers } = await import('../../utils/logger.js');
const { getSheetData, appendValuesToSheet } = await import('../../googleApi/googleSheetsApi.js');

describe('googleSheetsApi', () => {
  const mockGet = jest.fn();
  const mockAppend = jest.fn();

  beforeAll(() => {
    // Set up sheets mock implementation once
    (sheets as jest.Mock).mockReturnValue({
      spreadsheets: {
        values: {
          get: mockGet,
          append: mockAppend,
        },
      },
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReset();
    mockAppend.mockReset();
  });

  describe('getSheetData', () => {
    it('should call sheets.spreadsheets.values.get with correct parameters', async () => {
      const mockResponse = { data: { values: [['1', '2']] } };

      mockGet.mockResolvedValueOnce(mockResponse as never);

      const result = await getSheetData();

      expect(sheets).toHaveBeenCalledWith({ version: 'v4', auth: { mock: 'auth-client' } });
      expect(mockGet).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        range: 'Despesas!A2:E',
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should log error and rethrow if get fails', async () => {
      const mockError = new Error('API Error');

      mockGet.mockRejectedValueOnce(mockError as never);

      await expect(getSheetData()).rejects.toThrow('API Error');
      expect(loggers.errorWithContext).toHaveBeenCalledWith(mockError, 'Google Sheets API');
    });
  });

  describe('appendValuesToSheet', () => {
    it('should call sheets.spreadsheets.values.append with correct parameters', async () => {
      const mockResponse = { data: { updates: { updatedCells: 2 } } };

      mockAppend.mockResolvedValueOnce(mockResponse as never);

      const values = [['val1', 'val2']];
      const result = await appendValuesToSheet(values);

      expect(mockAppend).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        range: 'Despesas!A2:E2',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: values,
        },
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should log error if append fails', async () => {
      const mockError = new Error('Append Error');

      mockAppend.mockRejectedValueOnce(mockError as never);

      const result = await appendValuesToSheet([['val1']]);

      expect(loggers.errorWithContext).toHaveBeenCalledWith(mockError, 'Google Sheets API');
      expect(result).toBeUndefined(); // The function catches and doesn't rethrow
    });
  });
});
