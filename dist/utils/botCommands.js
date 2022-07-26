"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const googlePhotosAPI_1 = __importDefault(require("./googlePhotosAPI"));
const logger_1 = __importDefault(require("./logger"));
const utils_1 = __importDefault(require("./utils"));
const botCommands = (bot) => {
    const { getAlbums, createAlbum } = (0, googlePhotosAPI_1.default)();
    const { saveFile, getDays, getLineup, getInfoMessage } = (0, utils_1.default)();
    // Get the lineup for a specific day
    bot.command('lineup', (ctx) => {
        ctx.reply('Please select the day', telegraf_1.Markup.inlineKeyboard(getDays().map((day) => telegraf_1.Markup.button.callback(`${new Date(day).toLocaleString('default', { weekday: 'long' })}`, `lineup-${day}`))));
    });
    // Listen for button clicks on lineup command
    bot.action(/^(lineup-)\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/gm, (ctx) => {
        try {
            ctx.replyWithHTML(getLineup(ctx.match[0].replace('lineup-', '')));
        }
        catch (e) {
            logger_1.default.error(e);
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
};
exports.default = botCommands;
//# sourceMappingURL=botCommands.js.map