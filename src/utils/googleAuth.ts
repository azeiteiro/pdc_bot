import { google, Auth } from 'googleapis';
import readLine from 'readline';
import { readFile, readFileSync, writeFile } from 'fs';
import { createServer } from 'http';
import { createHttpTerminator } from 'http-terminator';
import open from 'open';
import logger from './logger';

type credentials = {
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
};

const googleAuth = () => {
  const authCredentials: credentials = {
    clientId: process.env.CLIENT_ID || '',
    clientSecret: process.env.CLIENT_SECRET || '',
    redirectUrl: process.env.REDIRECT_URL || '',
  };

  // If modifying these scopes, delete token.json.
  const SCOPES = ['https://www.googleapis.com/auth/photoslibrary.readonly'];

  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  const TOKEN_PATH = '.token.json';

  const saveTokensToFile = (token: Auth.Credentials) => {
    // Store the token to disk for later program executions
    writeFile(TOKEN_PATH, JSON.stringify(token), (e) => {
      if (e) {
        return logger.error(e);
      }

      return logger.debug(`Token stored to ${TOKEN_PATH}`);
    });
  };

  const verifyAutentication = () =>
    // eslint-disable-next-line no-new
    new Promise<Auth.OAuth2Client>(() => {
      logger.info('Checking Google auth tokens');

      const { clientId, clientSecret, redirectUrl } = authCredentials;
      const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUrl);

      // Check if we have previously stored a token.
      const savedTokens = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));

      if (savedTokens && savedTokens.access_token && savedTokens.refresh_token) {
        oAuth2Client.setCredentials(savedTokens);

        oAuth2Client
          .getTokenInfo(savedTokens.access_token)
          .then((data) => {
            logger.debug(`Valid token. Token Info: ${JSON.stringify(data)}`);
            console.log('TERMINA TODO O FLOW AGORA ***********');
          })
          .catch(() => {
            logger.error('Invalid Token, requesting a new one');

            oAuth2Client.getAccessToken().then((res) => {
              if (res.token) {
                logger.debug(`New Token: ${JSON.stringify(res.token)}`);
                saveTokensToFile({ ...savedTokens, access_token: res.token } as Auth.Credentials);
                console.log('TERMINA TODO O FLOW AGORA ***********');
              } else {
                logger.debug('Error retrieving the new token');
              }
            });
          });
      }
    });

  const getOauth = async () => {
    console.log('ANTES');
    await verifyAutentication();
    console.log('DEPOIS');
  };

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {credentials} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  const authenticateWithConsole = (callback: (oauthClient: Auth.OAuth2Client) => void) => {
    const { clientId, clientSecret, redirectUrl } = authCredentials;

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUrl);

    /**
     * Get and store new token after prompting for user authorization, and then
     * execute the given callback with the authorized OAuth2 client.
     * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
     * @param {getEventsCallback} callback The callback for the authorized client.
     */
    const getNewToken = (fCallback: (oauthClient: Auth.OAuth2Client) => void) => {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
      });

      logger.info('Authorize this app by visiting this url:', authUrl);

      const rl = readLine.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('Enter the code from that page here: ', (code) => {
        rl.close();

        oAuth2Client.getToken(code, (err, token) => {
          if (err || !token) {
            return logger.error('Error retrieving access token', err);
          }

          oAuth2Client.setCredentials(token);

          saveTokensToFile(token);

          return fCallback(oAuth2Client);
        });
      });
    };

    // Check if we have previously stored a token.
    readFile(TOKEN_PATH, (error, token) => {
      if (error || !token) {
        return getNewToken(callback);
      }

      oAuth2Client.setCredentials(JSON.parse(token.toString()));

      return callback(oAuth2Client);
    });
  };

  const authenticateWithBrowser = async () =>
    new Promise((resolve, reject) => {
      const { clientId, clientSecret, redirectUrl } = authCredentials;

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUrl);

      // grab the url that will be used for authorization
      const authorizeUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES.join(' '),
      });

      const server = createServer(async (req, res) => {
        try {
          if (req?.url && req.url.indexOf('/auth/google') > -1) {
            const qs = new URL(req.url, 'http://127.0.0.1:8080').searchParams;

            res.end('Authentication successful! Please return to the console.');

            server.close();

            createHttpTerminator({
              server,
            }).terminate();

            const { tokens } = await oauth2Client.getToken(qs.get('code') || '');

            oauth2Client.credentials = tokens; // eslint-disable-line require-atomic-updates

            saveTokensToFile(tokens);

            resolve(oauth2Client);
          }
        } catch (e) {
          reject(e);
        }
      }).listen(8080, () => {
        // open the browser to the authorize url to start the workflow
        open(authorizeUrl, { wait: false })
          .then((cp) => cp.unref())
          .catch((e) => logger.error(`Cannot open browser window: ${JSON.stringify(e)}`));
      });
    });

  return { authenticateWithConsole, authenticateWithBrowser, verifyAutentication, getOauth };
};

export default googleAuth;
