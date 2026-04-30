/**
 * Environment configuration and validation module
 * Validates all required environment variables at application startup
 */

import logger from '../utils/logger.js';
import fs from 'fs';

interface EnvironmentConfig {
  // Bot configuration
  nodeEnv: 'development' | 'production';
  botToken: string;
  groupChatId: string;
  adminIds: number[];

  // Google API configuration
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUrl: string;
  googleSpreadsheetId: string;
  googleSheetId: string;

  // Google Photos configuration
  uploadToGPhotos: boolean;
  albumId: string;
  albumUrl: string;
  photoDescription: string;

  // Weather API
  accuweatherApiKey: string;

  // Legacy
  basePath: string;
}

/**
 * Validate and parse environment variables
 * Exits the process if any required variables are missing or invalid
 */
export const validateEnvironment = (): EnvironmentConfig => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Diagnostic: Check if .env file exists in current working directory
  if (fs.existsSync('.env')) {
    // If process.env.NODE_ENV is not set, it's likely the user ran the app
    // without the --env-file flag. We can try to load it manually using
    // the native Node.js loadEnvFile function (v20.12.0+)
    if (!process.env.NODE_ENV) {
      try {
        process.loadEnvFile('.env');
        logger.info('✓ Loaded .env file automatically using process.loadEnvFile()');
      } catch (error) {
        warnings.push(`Found .env but failed to load it: ${(error as Error).message}`);
      }
    }
  } else {
    warnings.push(`.env file not found in ${process.cwd()}! Environment variables may be missing.`);
  }

  // Determine environment
  const nodeEnv = process.env.NODE_ENV as 'development' | 'production' | undefined;

  if (!nodeEnv) {
    errors.push('NODE_ENV is required (must be "development" or "production")');
  } else if (nodeEnv !== 'development' && nodeEnv !== 'production') {
    errors.push(`NODE_ENV must be "development" or "production", got "${nodeEnv}"`);
  }

  // Get the appropriate bot token based on environment
  const botToken =
    nodeEnv === 'development'
      ? process.env.BOT_DEVELOPMENT_TOKEN
      : process.env.BOT_PRODUCTION_TOKEN;

  if (!botToken) {
    const tokenVar = nodeEnv === 'development' ? 'BOT_DEVELOPMENT_TOKEN' : 'BOT_PRODUCTION_TOKEN';

    errors.push(`${tokenVar} is required for ${nodeEnv} environment`);
  }

  // Validate ADMIN_IDS
  let adminIds: number[] = [];

  if (!process.env.ADMIN_IDS) {
    errors.push('ADMIN_IDS is required (should be a JSON array, e.g., [123456, 789012])');
  } else {
    try {
      const parsed = JSON.parse(process.env.ADMIN_IDS);

      if (!Array.isArray(parsed)) {
        errors.push('ADMIN_IDS must be a JSON array');
      } else if (parsed.length === 0) {
        warnings.push('ADMIN_IDS is empty - no admin access will be granted');
      } else if (!parsed.every((id) => typeof id === 'number')) {
        errors.push('All ADMIN_IDS must be numbers');
      } else {
        adminIds = parsed;
      }
    } catch {
      errors.push('ADMIN_IDS must be valid JSON (e.g., [123456, 789012])');
    }
  }

  // Validate required string fields
  const requiredFields = {
    GROUP_CHAT_ID: process.env.GROUP_CHAT_ID,
    ONBOARDING_SHEET_ID: process.env.ONBOARDING_SHEET_ID,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URL: process.env.GOOGLE_REDIRECT_URL,
    GOOGLE_SPREADSHEET_ID: process.env.GOOGLE_SPREADSHEET_ID,
    GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
    ALBUM_ID: process.env.ALBUM_ID,
    ALBUM_URL: process.env.ALBUM_URL,
    ACCUWEATHER_API_KEY: process.env.ACCUWEATHER_API_KEY,
  };

  for (const [key, value] of Object.entries(requiredFields)) {
    if (!value || value.trim() === '') {
      errors.push(`${key} is required`);
    }
  }

  // Validate optional fields with defaults
  const uploadToGPhotos =
    process.env.UPLOAD_TO_GPHOTOS?.toLowerCase() === 'true' ||
    process.env.UPLOAD_TO_GPHOTOS === '1';

  const photoDescription = process.env.PHOTO_DESCRIPTION || '#festival';
  const basePath = process.env.BASE_PATH || '../..';

  // Validate URL format
  if (process.env.GOOGLE_REDIRECT_URL && !process.env.GOOGLE_REDIRECT_URL.startsWith('http')) {
    errors.push('GOOGLE_REDIRECT_URL must be a valid URL starting with http:// or https://');
  }

  if (process.env.ALBUM_URL && !process.env.ALBUM_URL.startsWith('http')) {
    errors.push('ALBUM_URL must be a valid URL starting with http:// or https://');
  }

  // Report errors and warnings
  if (warnings.length > 0) {
    logger.warn('Environment configuration warnings:');
    warnings.forEach((warning) => logger.warn(`  ⚠️  ${warning}`));
  }

  if (errors.length > 0) {
    // Output to both logger and console to ensure visibility
    // (logger may not flush before process.exit in production)
    const errorMessage = 'Environment configuration errors:';

    logger.error(errorMessage);
    console.error(errorMessage);

    errors.forEach((error) => {
      const msg = `  ❌ ${error}`;

      logger.error(msg);
      console.error(msg);
    });

    const footer =
      '\nPlease check your .env file and ensure all required variables are set.\nSee .env.example for reference.\n';

    logger.error(footer);
    console.error(footer);

    process.exit(1);
  }

  logger.info('✓ Environment configuration validated successfully');

  return {
    nodeEnv: nodeEnv!,
    botToken: botToken!,
    groupChatId: requiredFields.GROUP_CHAT_ID!,
    adminIds,
    googleClientId: requiredFields.GOOGLE_CLIENT_ID!,
    googleClientSecret: requiredFields.GOOGLE_CLIENT_SECRET!,
    googleRedirectUrl: requiredFields.GOOGLE_REDIRECT_URL!,
    googleSpreadsheetId: requiredFields.GOOGLE_SPREADSHEET_ID!,
    googleSheetId: requiredFields.GOOGLE_SHEET_ID!,
    uploadToGPhotos,
    albumId: requiredFields.ALBUM_ID!,
    albumUrl: requiredFields.ALBUM_URL!,
    photoDescription,
    accuweatherApiKey: requiredFields.ACCUWEATHER_API_KEY!,
    basePath,
  };
};

// Export a singleton config instance
export const config = validateEnvironment();
