import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockRequest = jest.fn();

jest.unstable_mockModule('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('file-buffer'),
}));

const mockFs = await import('fs');
const readFileSyncMock = mockFs.readFileSync as jest.Mock;

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  loggers: {
    errorWithContext: jest.fn(),
  },
}));

jest.unstable_mockModule('../../googleApi/googleAuth.js', () => ({
  getOAuth2Client: jest.fn().mockResolvedValue({
    request: mockRequest,
    credentials: { access_token: 'test-token' },
  } as never),
  verifyAutentication: jest.fn(),
}));

const { getAlbums, createAlbum, getAlbumInfo, savePhoto } =
  await import('../../googleApi/googlePhotosAPI.js');
const { loggers } = await import('../../utils/logger.js');

describe('googlePhotosAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAlbums', () => {
    it('should recursively fetch albums if a nextPageToken exists', async () => {
      mockRequest
        .mockResolvedValueOnce({
          data: {
            albums: [{ id: 'album1', title: 'Album 1' }],
            nextPageToken: 'token123',
          },
        } as never)
        .mockResolvedValueOnce({
          data: {
            albums: [{ id: 'album2', title: 'Album 2' }],
            // no next page token
          },
        } as never);

      const result = await getAlbums();

      expect(mockRequest).toHaveBeenCalledTimes(2);
      expect(mockRequest).toHaveBeenNthCalledWith(1, {
        url: 'https://photoslibrary.googleapis.com/v1/albums',
      });
      expect(mockRequest).toHaveBeenNthCalledWith(2, {
        url: 'https://photoslibrary.googleapis.com/v1/albums?pageToken=token123',
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('album1');
      expect(result[1].id).toBe('album2');
    });

    it('should handle errors gracefully', async () => {
      mockRequest.mockRejectedValueOnce(new Error('API error') as never);

      const result = await getAlbums();

      expect(result).toEqual([]); // Returns the empty array on error
    });
  });

  describe('createAlbum', () => {
    it('should create an album successfully', async () => {
      mockRequest.mockResolvedValueOnce({
        data: {
          id: 'new-album-id',
          title: 'My Album',
          productUrl: 'http://photos/my-album',
          isWriteable: true,
        },
      } as never);

      const result = await createAlbum('My Album');

      expect(mockRequest).toHaveBeenCalledWith({
        url: 'https://photoslibrary.googleapis.com/v1/albums',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        data: {
          album: { title: 'My Album' },
        },
      });

      expect(result).toContain('Album My Album created');
      expect(result).toContain('ID: new-album-id');
    });

    it('should handle creation errors', async () => {
      mockRequest.mockRejectedValueOnce('API error' as never);

      const result = await createAlbum('Failed Album');

      expect(result).toBe('Error creating album');
    });
  });

  describe('getAlbumInfo', () => {
    it('should fetch album info', async () => {
      mockRequest.mockResolvedValueOnce({
        data: { id: 'album123', title: 'Test Album' },
      } as never);

      const result = await getAlbumInfo('album123');

      expect(mockRequest).toHaveBeenCalledWith({
        url: 'https://photoslibrary.googleapis.com/v1/albums/album123',
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      });
      expect(result.id).toBe('album123');
    });

    it('should return empty object on error', async () => {
      mockRequest.mockRejectedValueOnce(new Error('API Error') as never);

      const result = await getAlbumInfo('bad-album');

      expect(loggers.errorWithContext).toHaveBeenCalled();
      expect(result).toEqual({});
    });
  });

  describe('savePhoto', () => {
    it('should upload photo and create media item', async () => {
      // 1st request: Upload bytes
      mockRequest.mockResolvedValueOnce({ data: 'upload-token-123' } as never);
      // 2nd request: Create media item
      mockRequest.mockResolvedValueOnce({
        data: { newMediaItemResults: ['success'] },
      } as never);

      await savePhoto('album123', 'test.jpg');

      expect(readFileSyncMock).toHaveBeenCalledWith('test.jpg');

      // Check upload request
      expect(mockRequest).toHaveBeenNthCalledWith(1, {
        url: 'https://photoslibrary.googleapis.com/v1/uploads',
        method: 'POST',
        headers: expect.objectContaining({
          'Content-type': 'application/octet-stream',
          'X-Goog-Upload-Content-Type': 'image/jpeg',
        }),
        data: 'file-buffer',
      });

      // Check media creation request
      expect(mockRequest).toHaveBeenNthCalledWith(2, {
        url: 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
        method: 'POST',
        headers: expect.objectContaining({
          'Content-type': 'application/json',
        }),
        data: {
          albumId: 'album123',
          newMediaItems: [
            {
              description: process.env.PHOTO_DESCRIPTION,
              simpleMediaItem: {
                uploadToken: 'upload-token-123',
                fileName: expect.stringMatching(/\.jpg$/),
              },
            },
          ],
        },
      });
    });

    it('should use correct mime types for different extensions', async () => {
      mockRequest.mockResolvedValue({ data: 'token' } as never);

      await savePhoto('a1', 'video.mp4');
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Goog-Upload-Content-Type': 'video/mp4' }),
        }),
      );
    });

    it('should handle media creation error', async () => {
      mockRequest.mockResolvedValueOnce({ data: 'upload-token-123' } as never);
      mockRequest.mockRejectedValueOnce(new Error('Creation Error') as never);

      await savePhoto('album123', 'test.jpg');

      expect(loggers.errorWithContext).toHaveBeenCalledWith(expect.any(Error), 'Google Photos API');
    });

    it('should handle upload error', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Upload Error') as never);

      await savePhoto('album123', 'test.jpg');

      expect(loggers.errorWithContext).toHaveBeenCalledWith(expect.any(Error), 'Google Photos API');
    });
  });
});
