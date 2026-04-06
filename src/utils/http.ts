import logger from './logger.js';

/**
 * Fetch JSON data from a URL with automatic error handling
 */
export async function fetchJSON<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    logger.error({ url, error }, `Failed to fetch JSON from ${url}`);
    throw error;
  }
}

/**
 * Fetch a stream (for file downloads)
 */
export async function fetchStream(url: string, options?: RequestInit): Promise<ReadableStream> {
  const response = await fetch(url, { ...options, method: options?.method || 'GET' });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  return response.body;
}
