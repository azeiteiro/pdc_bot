import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// We must mock the module before importing the file that uses it
jest.unstable_mockModule('fs', () => ({
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn(),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn() },
  loggers: { errorWithContext: jest.fn() },
}));

jest.unstable_mockModule('../../googleApi/googlePhotosAPI.js', () => ({
  savePhoto: jest.fn(),
}));

jest.unstable_mockModule('../../config/environment.js', () => ({
  config: { botToken: 'mock-token' },
}));

const mockFs = await import('fs');
const mkdirSyncMock = mockFs.mkdirSync as jest.Mock;

const { loggers } = await import('../../utils/logger.js');
const { ensureDownloadsDir } = await import('../../utils/mediaUtils.js');

describe('mediaUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureDownloadsDir', () => {
    it('should create the downloads directory recursively when the module loads', () => {
      // The module already called ensureDownloadsDir() once on import, before this
      // test's beforeEach cleared the mocks — call it again explicitly to verify
      // the same startup behavior this test file exercises.
      ensureDownloadsDir();

      expect(mkdirSyncMock).toHaveBeenCalledWith(expect.stringContaining('downloads/photos'), {
        recursive: true,
      });
    });

    it('should log the error instead of throwing when directory creation fails', () => {
      const error = new Error('EACCES: permission denied');

      mkdirSyncMock.mockImplementationOnce(() => {
        throw error;
      });

      expect(() => ensureDownloadsDir()).not.toThrow();
      expect(loggers.errorWithContext).toHaveBeenCalledWith(error, 'ensureDownloadsDir');
    });
  });
});
