"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const fs_1 = require("fs");
const node_schedule_1 = __importDefault(require("node-schedule"));
const telegraf_1 = require("telegraf");
const process_1 = require("process");
const googlePhotosAPI_1 = __importDefault(require("./googlePhotosAPI"));
const logger_1 = __importDefault(require("./logger"));
exports.default = () => {
    // Creates /downloads/photos, regardless of whether `/downloads` and /downloads/photos exist.
    (0, fs_1.access)('/downloads/photos', (error) => {
        if (error) {
            (0, fs_1.mkdir)(`${(0, process_1.cwd)()}/downloads/photos`, { recursive: true }, (err) => {
                if (err) {
                    throw err;
                }
            });
        }
    });
    const getJsonData = (fileName) => JSON.parse((0, fs_1.readFileSync)(`${__dirname}/../resources/${fileName}.json`, 'utf8'));
    const concertData = getJsonData('lineup');
    const subscribeAlerts = (bot, chatId) => {
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
                    bot.telegram.sendMessage(chatId, text, {
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
            .then((response) => response.data.pipe((0, fs_1.createWriteStream)(filePath)).on('finish', () => {
            if (process.env.UPLOAD_TO_GPHOTOS === true) {
                savePhoto(process.env.ALBUM_ID, filePath);
            }
        }))
            .catch((error) => {
            logger_1.default.error(error);
        }));
    };
    const getLineup = (weekDay) => {
        const response = `<b>Line-up for ${new Date(weekDay).toLocaleString('default', {
            weekday: 'long',
        })}</b>\n`;
        if (!(weekDay in concertData)) {
            return '';
        }
        return `${response}\n${concertData[weekDay]
            .map((concert) => `<i>${concert.hour}</i>: <b>${concert.name}</b> - ${concert.stage}\n`)
            .join('')}`;
    };
    const getDays = () => Object.keys(concertData);
    const getDailyMessageText = (weather, day) => `Olá amigos! 👋\n\n` +
        `Espero que tenham tido uma boa noite, vamos lá preparar este dia que aí vem.\n\n` +
        `Hoje é ${new Date(day).toLocaleDateString('pt-PT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })}\n\n` +
        `As <a href="${weather.MobileLink}">temperaturas em Paredes de Coura</a> variam entre os ↘️ <b>${weather.Temperature.Minimum.Value}ºC</b> e os <b>${weather.Temperature.Maximum.Value}ºC</b> ↗️\n\n` +
        `Temos um dia ${weather.Day.IconPhrase.toLocaleLowerCase()}` +
        `<b>${weather.Day.HasPrecipitation ? ' com' : ' sem'}</b> chuva\n` +
        ` e uma noite ${weather.Night.IconPhrase.toLocaleLowerCase()}` +
        `<b>${weather.Night.HasPrecipitation ? ' com' : ' sem'}</b> chuva\n\n` +
        `Um bem-haja e tudo de bom! ❤️`;
    const generateDailyMessage = (ctx) => axios_1.default
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
        ctx
            .replyWithHTML(getDailyMessageText(response.data.DailyForecasts[0], day), {
            disable_web_page_preview: true,
        })
            .then(() => {
            const lineUp = getLineup(day);
            if (lineUp !== '') {
                ctx.replyWithHTML(lineUp).then((message) => {
                    ctx.unpinAllChatMessages().then(() => ctx.pinChatMessage(message.message_id));
                });
            }
        });
    })
        .catch((error) => {
        logger_1.default.error(error);
        return error;
    });
    const getInfoMessage = (ctx) => {
        const { getAlbumInfo } = (0, googlePhotosAPI_1.default)();
        getAlbumInfo(process.env.ALBUM_ID).then((album) => ctx.replyWithHTML(`<b>Links úteis:</b>\n\n📷 Álbum Google Photos: <a href="${album.productUrl}">${album.title}</a>\n\nℹ️ Folha com contas e outras informações: <a href="https://docs.google.com/spreadsheets/d/1TMC-L1lfwczN5GihYv2Nm48DrS0kuGJ3iTspW8NpYUE/edit#gid=429680491">Pré-Festival Paredes de Coura 2022</a>`, {
            disable_web_page_preview: true,
        }));
    };
    return {
        subscribeAlerts,
        getLineup,
        saveFile,
        getDays,
        getJsonData,
        generateDailyMessage,
        getInfoMessage,
    };
};
//# sourceMappingURL=utils.js.map