/* eslint-disable no-console */
import { google, Auth } from 'googleapis';
import readLine from 'readline';
import { readFile, writeFile } from 'fs';
import { createServer } from 'http';
import { createHttpTerminator } from 'http-terminator';
import opn from 'open';

// https://github.com/googleapis/google-api-nodejs-client
type credentials = {
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
};

const googlePhotos = () => {
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

      console.log('Authorize this app by visiting this url:', authUrl);

      const rl = readLine.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('Enter the code from that page here: ', (code) => {
        rl.close();

        oAuth2Client.getToken(code, (err, token) => {
          if (err || !token) {
            return console.error('Error retrieving access token', err);
          }

          oAuth2Client.setCredentials(token);

          // Store the token to disk for later program executions
          writeFile(TOKEN_PATH, JSON.stringify(token), (e) => {
            if (e) {
              return console.error(e);
            }

            return console.log('Token stored to', TOKEN_PATH);
          });

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

            resolve(oauth2Client);
          }
        } catch (e) {
          reject(e);
        }
      }).listen(8080, () => {
        // open the browser to the authorize url to start the workflow
        opn(authorizeUrl, { wait: false })
          .then((cp) => cp.unref())
          .catch((e) => console.log(e));
      });
    });

  return { authenticateWithConsole, authenticateWithBrowser };
};

export default googlePhotos;
