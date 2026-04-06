/**
 * Lazy loading service for JSON resources
 * Files are only loaded on first access and cached in memory
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Command, FestivalData } from '../types/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for loaded data
let festivalDataCache: FestivalData | null = null;
let commandsCache: Command[] | null = null;

/**
 * Get the path to a resource file, supporting both bundled (dist/app.js)
 * and unbundled (src/utils/ or tsc-dist/utils/) directory structures.
 */
const getResourcePath = (filename: string): string => {
  // Option 1: tsc-compiled or src path (relative to src/utils/ or dist/utils/)
  const sourcePath = join(__dirname, '../resources', filename);
  // Option 2: bundled path (relative to dist/app.js)
  const bundledPath = join(__dirname, './resources', filename);

  if (existsSync(bundledPath)) {
    return bundledPath;
  }

  return sourcePath;
};

/**
 * Get festival lineup data (lazy loaded and cached)
 */
export const getFestivalData = (): FestivalData => {
  if (!festivalDataCache) {
    const filePath = getResourcePath('lineup.json');
    const fileContent = readFileSync(filePath, 'utf-8');

    festivalDataCache = JSON.parse(fileContent) as FestivalData;
  }

  return festivalDataCache;
};

/**
 * Get commands data (lazy loaded and cached)
 */
export const getCommands = (): Command[] => {
  if (!commandsCache) {
    const filePath = getResourcePath('commands.json');
    const fileContent = readFileSync(filePath, 'utf-8');

    commandsCache = JSON.parse(fileContent) as Command[];
  }

  return commandsCache;
};

/**
 * Clear cache (useful for testing or if data needs to be reloaded)
 */
export const clearCache = (): void => {
  festivalDataCache = null;
  commandsCache = null;
};
