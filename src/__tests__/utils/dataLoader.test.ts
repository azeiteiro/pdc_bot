import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// We must mock the module before importing the file that uses it
jest.unstable_mockModule('fs', () => ({
  readFileSync: jest.fn(),
}));

const mockFs = await import('fs');
const readFileSyncMock = mockFs.readFileSync as jest.Mock;

const { getFestivalData, getCommands, clearCache } = await import('../../utils/dataLoader.js');

describe('dataLoader', () => {
  beforeEach(() => {
    clearCache();
    jest.clearAllMocks();
  });

  describe('getFestivalData', () => {
    it('should read lineup.json on first access', () => {
      const mockData = {
        '2026-08-14': [
          { hour: '20:00', name: 'Band A', stage: 'Main Stage', url: 'http://banda.com', day: 14 },
        ],
      };

      readFileSyncMock.mockReturnValueOnce(JSON.stringify(mockData));

      const data1 = getFestivalData();

      expect(data1).toEqual(mockData);
      expect(readFileSyncMock).toHaveBeenCalledTimes(1);
    });

    it('should use cached data on subsequent accesses', () => {
      const mockData = {
        '2026-08-15': [],
      };

      readFileSyncMock.mockReturnValueOnce(JSON.stringify(mockData));

      getFestivalData(); // First call, loads from fs
      const data2 = getFestivalData(); // Second call, uses cache

      expect(data2).toEqual(mockData);
      expect(readFileSyncMock).toHaveBeenCalledTimes(1); // Still only called once
    });
  });

  describe('getCommands', () => {
    it('should read commands.json on first access', () => {
      const mockCommands = [{ command: 'start', description: 'Start the bot', adminOnly: false }];

      readFileSyncMock.mockReturnValueOnce(JSON.stringify(mockCommands));

      const data1 = getCommands();

      expect(data1).toEqual(mockCommands);
      expect(readFileSyncMock).toHaveBeenCalledTimes(1);
    });

    it('should use cached data on subsequent accesses', () => {
      const mockCommands = [{ command: 'help', description: 'Show help', adminOnly: false }];

      readFileSyncMock.mockReturnValueOnce(JSON.stringify(mockCommands));

      getCommands(); // First call
      const data2 = getCommands(); // Second call

      expect(data2).toEqual(mockCommands);
      expect(readFileSyncMock).toHaveBeenCalledTimes(1); // Still only called once
    });
  });
});
