define("utils/logger", ["require", "exports", "winston"], function (require, exports, winston_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const customLevels = {
        levels: {
            ...winston_1.default.config.npm.levels,
            userChat: 7,
        },
        colors: {
            ...winston_1.default.config.npm.colors,
            userChat: 'green',
        },
    };
    const logFormat = winston_1.format.printf((info) => `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`);
    const logger = winston_1.default.createLogger({
        levels: customLevels.levels,
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        format: winston_1.format.combine(winston_1.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.format.label({ label: 'output' }), 
        // Format the metadata object
        winston_1.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] })),
        transports: [
            new winston_1.transports.Console({
                format: winston_1.format.combine(winston_1.format.colorize(), logFormat),
            }),
            new winston_1.transports.File({
                filename: 'logs/logger.log',
                format: winston_1.format.combine(winston_1.format.json()),
            }),
            new winston_1.transports.File({
                filename: 'logs/error.log',
                format: winston_1.format.combine(winston_1.format.json()),
                level: 'error',
            }),
            new winston_1.transports.File({
                filename: 'logs/chat.log',
                format: winston_1.format.combine(winston_1.format.json()),
                level: 'userChat',
            }),
        ],
        exitOnError: false,
    });
    if (process.env.NODE_ENV !== 'production') {
        logger.add(new winston_1.default.transports.Console({
            level: 'debug',
            format: winston_1.default.format.simple(),
        }));
    }
    exports.default = logger;
});
define("types/types", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
});
define("utils/googleAuth", ["require", "exports", "readline", "fs", "http", "http-terminator", "open", "googleapis", "utils/logger"], function (require, exports, readline_1, fs_1, http_1, http_terminator_1, open_1, googleapis_1, logger_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
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
                logger_1.default.log('Authorize this app by visiting this url:', authUrl);
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
                        // server.close();
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
            logger_1.default.info('Checking Google auth tokens before obtaining a new one');
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
});
define("utils/googlePhotosAPI", ["require", "exports", "fs", "path", "utils/googleAuth", "utils/logger"], function (require, exports, fs_2, path_1, googleAuth_1, logger_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const googlePhotosAPI = () => {
        const { getOauth, verifyAutentication } = (0, googleAuth_1.default)();
        const oAuth2Client = getOauth();
        const getAlbums = async (albums = [], pageToken = '') => oAuth2Client.then((p) => p
            .request({
            url: `https://photoslibrary.googleapis.com/v1/albums${pageToken ? `?pageToken=${pageToken}` : ''}`,
        })
            .then((res) => {
            const data = res.data;
            if (data.albums) {
                // eslint-disable-next-line no-param-reassign
                albums = [...albums, ...data.albums];
            }
            return data.nextPageToken ? getAlbums(albums, data.nextPageToken) : albums;
        })
            .catch((err) => {
            logger_2.default.error(err);
        }));
        const createAlbum = (albumName) => oAuth2Client.then((p) => p
            .request({
            url: `https://photoslibrary.googleapis.com/v1/albums`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                Authorization: `Bearer ${p.credentials.access_token}`,
            },
            data: {
                album: {
                    title: albumName,
                    isWriteable: true,
                },
            },
        })
            .then((res) => {
            logger_2.default.debug('Album created');
            logger_2.default.info(res.data);
            return `Album ${albumName} created`;
        })
            .catch((err) => {
            logger_2.default.error(err);
            return 'Error creating album';
        }));
        const getAlbumInfo = (albumId) => oAuth2Client.then((p) => p
            .request({
            url: `https://photoslibrary.googleapis.com/v1/albums/${albumId}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/octet-stream',
                Authorization: `Bearer ${p.credentials.access_token}`,
            },
        })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .then((res) => {
            logger_2.default.debug('Album info');
            logger_2.default.info(res.data);
            return res.data;
        })
            .catch((err) => {
            logger_2.default.error(err);
            return 'Error getting album info';
        }));
        const savePhoto = (albumId, fileName) => {
            const file = (0, fs_2.readFileSync)(fileName);
            const extension = path_1.default.parse(fileName).ext;
            oAuth2Client.then((p) => p
                .request({
                url: 'https://photoslibrary.googleapis.com/v1/uploads',
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${p.credentials.access_token}`,
                    'Content-type': 'application/octet-stream',
                    'X-Goog-Upload-Content-Type': 'mime-type',
                    'X-Goog-Upload-Protocol': 'raw',
                    'X-Goog-Upload-File-Name': `${new Date().getTime()}${extension}`,
                },
                data: file,
            })
                .then((res) => {
                p.request({
                    url: 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
                    method: 'POST',
                    headers: {
                        'Content-type': 'application/json',
                        Authorization: `Bearer ${p.credentials.access_token}`,
                    },
                    data: {
                        albumId,
                        newMediaItems: [
                            {
                                description: process.env.PHOTO_DESCRIPTION,
                                simpleMediaItem: {
                                    uploadToken: res.data,
                                },
                            },
                        ],
                    },
                })
                    .then((uploadRes) => {
                    logger_2.default.info(uploadRes.data.newMediaItemResults);
                })
                    .catch((err) => {
                    logger_2.default.error(`Media upload error: ${err}`);
                });
            })
                .catch((err) => {
                logger_2.default.error(`Error retriving upload token: ${err}`);
                verifyAutentication();
            }));
        };
        return { getAlbums, savePhoto, createAlbum, getAlbumInfo };
    };
    exports.default = googlePhotosAPI;
});
define("utils/utils", ["require", "exports", "axios", "fs", "node-schedule", "telegraf", "process", "utils/googlePhotosAPI", "utils/logger", "../resources/lineup.json"], function (require, exports, axios_1, fs_3, node_schedule_1, telegraf_1, process_1, googlePhotosAPI_1, logger_3, lineup_json_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = () => {
        // Creates /downloads/photos, regardless of whether `/downloads` and /downloads/photos exist.
        (0, fs_3.access)('/downloads/photos', (error) => {
            if (error) {
                (0, fs_3.mkdir)(`${(0, process_1.cwd)()}/downloads/photos`, { recursive: true }, (err) => {
                    if (err) {
                        throw err;
                    }
                });
            }
        });
        const concertData = lineup_json_1.default;
        const subscribeAlerts = (bot) => {
            // Alert time delay in minutes
            const alertTimeDelay = 30;
            Object.keys(concertData).forEach((day) => {
                const dayData = concertData[day];
                dayData.forEach((c) => {
                    const text = `There will be a concert in ${alertTimeDelay} minutes:\n\n<b>${c.name}</b>\n\n` +
                        `<i>Starts at </i><b>${c.hour}</b><i> in </i><b>${c.stage}</b>\n`;
                    const announceTime = new Date(`${day} ${c.hour}`);
                    announceTime.setDate(c.day);
                    announceTime.setMinutes(announceTime.getMinutes() - alertTimeDelay);
                    node_schedule_1.default.scheduleJob(announceTime, () => {
                        bot.telegram.sendMessage(process.env.CHAT_ID, text, {
                            parse_mode: 'HTML',
                            disable_web_page_preview: true,
                            reply_markup: telegraf_1.Markup.inlineKeyboard([telegraf_1.Markup.button.url('view more info', c.url)])
                                .reply_markup,
                        });
                    });
                });
            });
        };
        const saveFile = (fileId, fileExtension, ctx) => {
            const { savePhoto } = (0, googlePhotosAPI_1.default)();
            const filePath = `${(0, process_1.cwd)()}/downloads/photos/${fileId}.${fileExtension}`;
            ctx.telegram.getFileLink(fileId).then((url) => axios_1.default
                .get(url.toString(), { responseType: 'stream' })
                .then((response) => response.data.pipe((0, fs_3.createWriteStream)(filePath)).on('finish', () => {
                if (`${process.env.UPLOAD_TO_GPHOTOS}` === 'true') {
                    savePhoto(process.env.ALBUM_ID, filePath);
                }
            }))
                .catch((error) => {
                logger_3.default.error(error);
            }));
        };
        const sortLineup = (dayLineup) => dayLineup.sort((a, b) => {
            if (a.day !== b.day) {
                return a.day - b.day;
            }
            return a.hour.localeCompare(b.hour);
        });
        const getLineup = (weekDay) => {
            const response = `<b>Line-up for ${new Date(weekDay).toLocaleString('en-GB', {
                weekday: 'long',
                day: '2-digit',
            })}</b>\n`;
            if (!(weekDay in concertData)) {
                return '';
            }
            const sortedData = sortLineup(concertData[weekDay]);
            return `${response}\n${sortedData
                .map((concert) => `<i>${concert.hour}</i>: <b><a href="${concert.url}">${concert.name}</a></b> - ${concert.stage}\n`)
                .join('')}`;
        };
        const getDays = () => Object.keys(concertData);
        const getDailyMessageText = (weather, day) => `Olá amigos! 👋\n\n` +
            `Espero que tenham tido uma boa noite.\n\n` +
            `Hoje é ${new Date(day).toLocaleDateString('pt-PT', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            })}\n\n` +
            `As <a href="${weather.MobileLink}">temperaturas em Paredes de Coura</a> variam entre os ↘️ <b>${weather.Temperature.Minimum.Value}ºC</b> e os <b>${weather.Temperature.Maximum.Value}ºC</b> ↗️\n\n` +
            `Temos um dia ${weather.Day.IconPhrase.toLocaleLowerCase()}` +
            `<b>${weather.Day.HasPrecipitation ? ' com' : ' sem'}</b> chuva\n` +
            ` e uma noite com tempo ${weather.Night.IconPhrase.toLocaleLowerCase()}` +
            `<b>${weather.Night.HasPrecipitation ? ' com' : ' sem'}</b> chuva\n\n` +
            `Um bem-haja e tudo de bom! ❤️`;
        const generateDailyMessage = (bot, chatId) => axios_1.default
            .get('http://dataservice.accuweather.com/forecasts/v1/daily/1day/276252', {
            params: {
                apikey: process.env.ACCUWEATHER_API_KEY,
                language: 'pt-pt',
                details: false,
                metric: true,
            },
        })
            .then((response) => {
            const day = new Date().toJSON().slice(0, 10);
            bot.telegram
                .sendMessage(chatId, getDailyMessageText(response.data.DailyForecasts[0], day), {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            })
                .then(() => {
                const lineUp = getLineup(day);
                if (lineUp !== '') {
                    bot.telegram
                        .sendMessage(chatId, lineUp, {
                        parse_mode: 'HTML',
                        disable_web_page_preview: true,
                    })
                        .then((message) => {
                        bot.telegram
                            .unpinAllChatMessages(chatId)
                            .then(() => bot.telegram.pinChatMessage(chatId, message.message_id));
                    });
                }
            });
        })
            .catch((error) => {
            logger_3.default.error(error);
            return error;
        });
        const getInfoMessage = (ctx) => {
            ctx
                .replyWithHTML(`<b>Links úteis:</b>\n\n📷 Álbum Google Photos: <a href="${process.env.ALBUM_URL}">🏳️‍🌈 Paredes de Coura 2023</a>\n\nℹ️ Folha com contas e outras informações: <a href="https://docs.google.com/spreadsheets/d/1jcOQLHsOIanFdlFO1cDcvxAAMjrnlaGbt8kKb8KvwRk/edit?usp=sharing">Pré-Festival Paredes de Coura 2022</a>`, {
                disable_web_page_preview: true,
            })
                .then(() => logger_3.default.log('userChat', ctx.message));
        };
        const scheduleDailyMessage = (bot) => {
            node_schedule_1.default.scheduleJob('0 0 9 * * *', () => {
                generateDailyMessage(bot, process.env.CHAT_ID);
            });
        };
        return {
            subscribeAlerts,
            getLineup,
            saveFile,
            getDays,
            generateDailyMessage,
            getInfoMessage,
            scheduleDailyMessage,
        };
    };
});
define("utils/botCommands", ["require", "exports", "telegraf", "utils/googlePhotosAPI", "utils/logger", "utils/utils"], function (require, exports, telegraf_2, googlePhotosAPI_2, logger_4, utils_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const botCommands = (bot) => {
        const { getAlbums, createAlbum } = (0, googlePhotosAPI_2.default)();
        const { saveFile, getDays, getLineup, getInfoMessage } = (0, utils_1.default)();
        // Get the lineup for a specific day
        bot.command('lineup', (ctx) => {
            console.log(ctx);
            ctx.reply('Please select the day', telegraf_2.Markup.inlineKeyboard(getDays().map((day) => telegraf_2.Markup.button.callback(`${new Date(day).toLocaleString('en-GB', { weekday: 'long', day: '2-digit' })}`, `lineup-${day}`)), {
                wrap: (btn, index) => index % 3 === 0,
            }));
            logger_4.default.log('userChat', ctx.message);
        });
        // Listen for button clicks on lineup command
        bot.action(/^(lineup-)\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/gm, (ctx) => {
            try {
                ctx.replyWithHTML(getLineup(ctx.match[0].replace('lineup-', '')), {
                    disable_web_page_preview: true,
                });
                logger_4.default.log('userChat', ctx.match);
            }
            catch (e) {
                logger_4.default.error(e);
                ctx.reply('Unknow error, please try again later');
            }
        });
        bot.on('video_note', (ctx) => {
            const file = ctx.update.message.video_note;
            const fileExtension = 'mp4';
            const fileId = file.file_id;
            saveFile(fileId, fileExtension, ctx);
        });
        bot.on('photo', (ctx) => {
            const files = ctx.update.message.photo;
            // Telegram stores multiple images size, last one is the bigger
            const fileId = files[files.length - 1].file_id;
            // Proceed downloading
            saveFile(fileId, 'jpg', ctx);
        });
        bot.on('video', (ctx) => {
            const file = ctx.update.message.video;
            const fileExtension = (file.file_name?.match(/\.([^.]*?)(?=\?|#|$)/) || [])[1];
            const fileId = file.file_id;
            // Proceed downloading
            saveFile(fileId, fileExtension, ctx);
        });
        // List Google Photos albums
        bot.command('albums', (ctx) => {
            const albums = getAlbums();
            let response = '';
            albums.then((p) => {
                p.forEach((album) => {
                    response += `${album.title}\n`;
                });
                ctx.reply(response);
                logger_4.default.log('userChat', ctx.message);
            });
        });
        // Create a new album
        bot.command('createAlbum', (ctx) => {
            if (!process.env.ADMIN_IDS.includes(ctx.from.id)) {
                ctx.reply("You're not allowed to do that");
                return;
            }
            const albumName = ctx.message.text.replace('/createAlbum ', '');
            if (albumName === '') {
                ctx.reply('You must specify an album name!\n /createAlbum <album name>');
                return;
            }
            ctx.reply('Creating the album, please wait').then((message) => {
                createAlbum(albumName).then((albumStatus) => {
                    ctx.reply(albumStatus, { reply_to_message_id: message.message_id });
                });
            });
        });
        bot.command('info', (ctx) => getInfoMessage(ctx));
        bot.command('help', (ctx) => {
            bot.telegram.getMyCommands().then((commands) => {
                const info = commands.reduce((acc, val) => `${acc}/${val.command} - ${val.description}\n`, '');
                ctx.reply(info);
            });
        });
        bot.command('about', (ctx) => {
            ctx.reply('This bot allows you to see the schedule for the PDC 2023 festival. Use /help to see more.');
        });
        // Log messages
        bot.on('message', (ctx) => {
            logger_4.default.log('userChat', ctx.message);
        });
    };
    exports.default = botCommands;
});
define("bots/mainBot", ["require", "exports", "telegraf", "utils/utils", "utils/botCommands", "../resources/commands.json"], function (require, exports, telegraf_3, utils_2, botCommands_1, commands_json_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const mainBot = () => {
        const { subscribeAlerts, scheduleDailyMessage } = (0, utils_2.default)();
        const { env } = process;
        const createBot = () => {
            const botToken = () => {
                switch (env.NODE_ENV) {
                    case 'development':
                        return env.BOT_DEVELOPMENT_TOKEN;
                    case 'staging':
                        return env.BOT_STAGING_TOKEN;
                    case 'production':
                        return env.BOT_PRODUCTION_TOKEN;
                    default:
                        return env.BOT_DEVELOPMENT_TOKEN;
                }
            };
            const bot = new telegraf_3.Telegraf(botToken());
            // Register bot commands
            (0, botCommands_1.default)(bot);
            // Enable graceful stop
            process.once('SIGINT', () => bot.stop('SIGINT'));
            process.once('SIGTERM', () => bot.stop('SIGTERM'));
            return bot;
        };
        const telegramBot = createBot();
        const scheduleMessages = () => {
            subscribeAlerts(telegramBot);
            // scheduleDailyMessage(telegramBot);
        };
        telegramBot.start((ctx) => ctx.reply('Welcome'));
        telegramBot.settings(async (ctx) => {
            const botCommands = commands_json_1.default;
            await telegramBot.telegram.setMyCommands(botCommands);
            return ctx.reply('Ok');
        });
        telegramBot.help(async (ctx) => {
            const commandsInfo = await telegramBot.telegram.getMyCommands();
            const info = commandsInfo.reduce((acc, val) => `${acc}/${val.command} - ${val.description}\n`, '');
            return ctx.reply(info);
        });
        telegramBot.action('delete', (ctx) => ctx.deleteMessage());
        telegramBot.on('dice', (ctx) => ctx.reply(`Value: ${ctx.message.dice.value}`));
        telegramBot.launch();
        return { telegramBot, scheduleMessages };
    };
    exports.default = mainBot;
});
define("app", ["require", "exports", "dotenv", "bots/mainBot"], function (require, exports, dotenv, mainBot_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const index = () => {
        dotenv.config();
        const { scheduleMessages } = (0, mainBot_1.default)();
        // Scheduled alert messages for subscribed users
        scheduleMessages();
    };
    index();
});
