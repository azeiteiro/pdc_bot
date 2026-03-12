/**
 * Lazy loading service for JSON resources
 * Files are only loaded on first access and cached in memory
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Command, FestivalData } from '../types/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for loaded data
let festivalDataCache: FestivalData | null = null;
let commandsCache: Command[] | null = null;

/**
 * Get festival lineup data (lazy loaded and cached)
 */
export const getFestivalData = (): FestivalData => {
  if (!festivalDataCache) {
    const filePath = join(__dirname, '../resources/lineup.json');
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
    const filePath = join(__dirname, '../resources/commands.json');
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
