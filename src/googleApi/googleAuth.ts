import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { createServer } from 'http';
import { createHttpTerminator } from 'http-terminator';
import open from 'open';
import { OAuth2Client, Credentials as OAuth2Credentials } from 'google-auth-library';
import logger from '../utils/logger.js';

// Configuration
const TOKEN_PATH = '.token.json';
const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.appendonly',
  'https://www.googleapis.com/auth/spreadsheets',
];

// Singleton instance
let clientInstance: OAuth2Client | null = null;

/**
 * Persists credentials to a local file.
 * Automatically sets restrictive file permissions.
 */
const saveTokensToFile = (tokens: OAuth2Credentials) => {
  try {
    console.error('DEBUG: Attempting to save tokens to file...');
    console.error('DEBUG: Tokens object:', JSON.stringify(tokens, null, 2));
    console.error('DEBUG: TOKEN_PATH:', TOKEN_PATH);
    writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    chmodSync(TOKEN_PATH, 0o600);
    console.error('DEBUG: Tokens successfully saved!');
    logger.debug(`Tokens successfully stored to ${TOKEN_PATH}`);
  } catch (error) {
    console.error('DEBUG: Error saving tokens:', error);
    logger.error({ err: error }, 'Failed to save tokens to file:');
  }
};

/**
 * Starts a temporary local HTTP server to handle the OAuth2 callback.
 * Automatically opens the browser for user consent.
 */
const authenticateWithBrowser = async (oauth2Client: OAuth2Client): Promise<OAuth2Client> => {
  return new Promise((resolve, reject) => {
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      include_granted_scopes: true,
    });

    const server = createServer(async (req, res) => {
      try {
        if (req?.url && req.url.includes('/auth/google/callback')) {
          const url = new URL(req.url, 'http://127.0.0.1:8080');
          const code = url.searchParams.get('code');

          if (!code) {
            res.end('Authentication failed: No code received.');
            reject(new Error('No authorization code received from callback.'));

            return;
          }

          res.end(
            'Authentication successful! You can close this window and return to the console.',
          );

          // Terminate the server immediately after receiving the code
          const terminator = createHttpTerminator({ server });

          await terminator.terminate();

          console.error('DEBUG: Received authorization code, getting tokens...');
          const { tokens } = await oauth2Client.getToken(code);

          console.error('DEBUG: Got tokens from Google');

          oauth2Client.setCredentials(tokens);
          console.error('DEBUG: Set credentials on oauth2Client');

          saveTokensToFile(tokens);
          console.error('DEBUG: Called saveTokensToFile');

          resolve(oauth2Client);
        }
      } catch (error) {
        res.end('Authentication failed. Check console for details.');
        reject(error);
      }
    });

    server.listen(8080, () => {
      logger.info('Starting browser-based authentication flow...');
      logger.info(`If the browser doesn't open automatically, visit: ${authorizeUrl}`);

      open(authorizeUrl, { wait: false })
        .then((cp) => cp.unref())
        .catch((error) => logger.error('Failed to open browser:', error));
    });

    server.on('error', (error) => {
      reject(new Error(`Local server error: ${error.message}`));
    });
  });
};

/**
 * Provides a configured and authorized OAuth2Client instance.
 * Implements lazy initialization and automatic token persistence.
 */
export const getOAuth2Client = async (): Promise<OAuth2Client> => {
  if (clientInstance) {
    return clientInstance;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUrl = process.env.GOOGLE_REDIRECT_URL;

  if (!clientId || !clientSecret || !redirectUrl) {
    throw new Error('Google OAuth credentials missing in environment variables.');
  }

  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUrl);

  // Setup auto-save for token refreshes
  oauth2Client.on('tokens', (tokens) => {
    // Merge new tokens with existing ones to avoid losing refresh_token
    const existingTokens = existsSync(TOKEN_PATH)
      ? JSON.parse(readFileSync(TOKEN_PATH, 'utf8'))
      : {};
    const mergedTokens = { ...existingTokens, ...tokens };

    saveTokensToFile(mergedTokens);
  });

  // Try to load existing tokens
  if (existsSync(TOKEN_PATH)) {
    try {
      const tokenContent = readFileSync(TOKEN_PATH, 'utf8');

      if (tokenContent.trim()) {
        const tokens = JSON.parse(tokenContent);

        oauth2Client.setCredentials(tokens);

        // Verify if refresh is possible or token is valid
        // google-auth-library handles token expiration internally if credentials are set.
      }
    } catch (error) {
      logger.error({ err: error }, 'Error loading existing tokens:');
    }
  }

  // If we don't have credentials yet, start the auth flow
  if (!oauth2Client.credentials.access_token && !oauth2Client.credentials.refresh_token) {
    logger.warn('No valid tokens found. Initializing interactive authentication...');
    clientInstance = await authenticateWithBrowser(oauth2Client);
  } else {
    clientInstance = oauth2Client;
  }

  return clientInstance;
};

/**
 * Legacy support for direct Promise export.
 * Deprecated: Prefer using getOAuth2Client() directly.
 */
export const oAuth2Client = getOAuth2Client();

/**
 * Force verification of authentication.
 * Useful for ensuring the token is valid before starting long-running operations.
 */
export const verifyAutentication = async (): Promise<void> => {
  const client = await getOAuth2Client();

  try {
    await client.getAccessToken();
    logger.debug('Google authentication verified.');
  } catch (error) {
    logger.error({ err: error }, 'Authentication verification failed:');
    clientInstance = null; // Clear singleton to force re-auth on next request
    await getOAuth2Client();
  }
};
