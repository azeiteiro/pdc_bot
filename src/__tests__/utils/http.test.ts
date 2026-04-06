import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('HTTP Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchJSON', () => {
    it('should fetch and parse JSON successfully', async () => {
      const mockData = { message: 'success' };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        }),
      ) as unknown as typeof fetch;

      const { fetchJSON } = await import('../../utils/http.js');
      const result = await fetchJSON('https://api.example.com/data');

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/data', undefined);
    });

    it('should throw error on HTTP error response', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        }),
      ) as unknown as typeof fetch;

      const { fetchJSON } = await import('../../utils/http.js');

      await expect(fetchJSON('https://api.example.com/missing')).rejects.toThrow(
        'HTTP 404: Not Found',
      );
    });
  });

  describe('fetchStream', () => {
    it('should fetch stream successfully', async () => {
      const mockBody = { pipe: jest.fn() };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          body: mockBody,
        }),
      ) as unknown as typeof fetch;

      const { fetchStream } = await import('../../utils/http.js');
      const result = await fetchStream('https://api.example.com/file');

      expect(result).toBe(mockBody);
      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/file', { method: 'GET' });
    });

    it('should throw error if response has no body', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          body: null,
        }),
      ) as unknown as typeof fetch;

      const { fetchStream } = await import('../../utils/http.js');

      await expect(fetchStream('https://api.example.com/file')).rejects.toThrow(
        'Response body is null',
      );
    });
  });
});
