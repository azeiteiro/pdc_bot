"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const googleapis_1 = require("googleapis");
const readline_1 = __importDefault(require("readline"));
const fs_1 = require("fs");
const http_1 = require("http");
const http_terminator_1 = require("http-terminator");
const open_1 = __importDefault(require("open"));
const logger_1 = __importDefault(require("./logger"));
const googleAuth = () => {
    const authCredentials = {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUrl: process.env.GOOGLE_REDIRECT_URL,
    };
    // If modifying these scopes, delete token.json.
    const SCOPES = ['https://www.googleapis.com/auth/photoslibrary'];
    // The file token.json stores the user's access and refresh tokens, and is
    // created automatically when the authorization flow completes for the first
    // time.
    const TOKEN_PATH = '.token.json';
    const saveTokensToFile = (token) => {
        // Store the token to disk for later program executions
        (0, fs_1.writeFile)(TOKEN_PATH, JSON.stringify(token), (e) => {
            if (e) {
                return logger_1.default.error(e);
            }
            return logger_1.default.debug(`Token stored to ${TOKEN_PATH}`);
        });
    };
    /**
     * Create an OAuth2 client with the given credentials, and then execute the
     * given callback function.
     * @param {credentials} credentials The authorization client credentials.
     * @param {function} callback The callback to call with the authorized client.
     */
    const authenticateWithConsole = (callback) => {
        const { clientId, clientSecret, redirectUrl } = authCredentials;
        const oAuth2Client = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, redirectUrl);
        /**
         * Get and store new token after prompting for user authorization, and then
         * execute the given callback with the authorized OAuth2 client.
         * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
         * @param {getEventsCallback} callback The callback for the authorized client.
         */
        const getNewToken = (fCallback) => {
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
            });
            logger_1.default.info('Authorize this app by visiting this url:', authUrl);
            const rl = readline_1.default.createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            rl.question('Enter the code from that page here: ', (code) => {
                rl.close();
                oAuth2Client.getToken(code, (err, token) => {
                    if (err || !token) {
                        return logger_1.default.error('Error retrieving access token', err);
                    }
                    oAuth2Client.setCredentials(token);
                    saveTokensToFile(token);
                    return fCallback(oAuth2Client);
                });
            });
        };
        // Check if we have previously stored a token.
        (0, fs_1.readFile)(TOKEN_PATH, (error, token) => {
            if (error || !token) {
                return getNewToken(callback);
            }
            oAuth2Client.setCredentials(JSON.parse(token.toString()));
            return callback(oAuth2Client);
        });
    };
    const authenticateWithBrowser = async () => new Promise((resolve, reject) => {
        const { clientId, clientSecret, redirectUrl } = authCredentials;
        const oauth2Client = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, redirectUrl);
        // grab the url that will be used for authorization
        const authorizeUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES.join(' '),
        });
        const server = (0, http_1.createServer)(async (req, res) => {
            try {
                if (req?.url && req.url.indexOf('/auth/google/callback') > -1) {
                    const qs = new URL(req.url, 'http://127.0.0.1:8080').searchParams;
                    res.end('Authentication successful! Please return to the console.');
                    server.close();
                    (0, http_terminator_1.createHttpTerminator)({
                        server,
                    }).terminate();
                    const { tokens } = await oauth2Client.getToken(qs.get('code') || '');
                    oauth2Client.credentials = tokens; // eslint-disable-line require-atomic-updates
                    saveTokensToFile(tokens);
                    resolve(oauth2Client);
                }
            }
            catch (e) {
                reject(e);
            }
        }).listen(8080, () => {
            // open the browser to the authorize url to start the workflow
            (0, open_1.default)(authorizeUrl, { wait: false })
                .then((cp) => cp.unref())
                .catch((e) => logger_1.default.error(`Cannot open browser window: ${JSON.stringify(e)}`));
        });
    });
    const verifyAutentication = () => {
        logger_1.default.info('Checking Google auth tokens');
        if (!(0, fs_1.existsSync)(TOKEN_PATH) || (0, fs_1.readFileSync)(TOKEN_PATH, 'utf8').length === 0) {
            logger_1.default.error('Token file not found. Starting autentication...');
            return authenticateWithBrowser();
        }
        const { clientId, clientSecret, redirectUrl } = authCredentials;
        const oAuth2Client = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, redirectUrl);
        // Check if we have previously stored a token.
        const savedTokens = JSON.parse((0, fs_1.readFileSync)(TOKEN_PATH, 'utf8'));
        if (savedTokens && savedTokens.access_token && savedTokens.refresh_token) {
            oAuth2Client.setCredentials(savedTokens);
            oAuth2Client
                .getTokenInfo(savedTokens.access_token)
                .then((data) => {
                logger_1.default.debug(`Valid token. Token Info: ${JSON.stringify(data)}`);
            })
                .catch(() => {
                logger_1.default.error('Invalid Token, requesting a new one');
                oAuth2Client.getAccessToken().then((res) => {
                    if (res.token) {
                        logger_1.default.debug(`New Token: ${JSON.stringify(res.token)}`);
                        saveTokensToFile({ ...savedTokens, access_token: res.token });
                    }
                    logger_1.default.debug('Error retrieving the new token');
                });
            })
                .finally(() => oAuth2Client);
        }
        return oAuth2Client;
    };
    const getOauth = async () => {
        logger_1.default.info('Checking Google auth tokens');
        if (!(0, fs_1.existsSync)(TOKEN_PATH) || (0, fs_1.readFileSync)(TOKEN_PATH, 'utf8').length === 0) {
            logger_1.default.error('Token file not found. Starting autentication...');
            return authenticateWithBrowser();
        }
        const { clientId, clientSecret, redirectUrl } = authCredentials;
        const oAuth2Client = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, redirectUrl);
        const savedTokens = JSON.parse((0, fs_1.readFileSync)(TOKEN_PATH, 'utf8'));
        oAuth2Client.setCredentials(savedTokens);
        return oAuth2Client;
    };
    return { authenticateWithConsole, authenticateWithBrowser, verifyAutentication, getOauth };
};
exports.default = googleAuth;
//# sourceMappingURL=googleAuth.js.map