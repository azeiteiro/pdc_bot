"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const utils_1 = __importDefault(require("../utils/utils"));
const botCommands_1 = __importDefault(require("../utils/botCommands"));
const mainBot = (devMode = true) => {
    const { subscribeAlerts, getJsonData } = (0, utils_1.default)();
    const { env } = process;
    const createBot = () => {
        const botToken = devMode ? env.BOT_DEVELOPMENT_TOKEN : env.BOT_PRODUCTION_TOKEN;
        const bot = new telegraf_1.Telegraf(botToken);
        // Register bot commands
        (0, botCommands_1.default)(bot);
        // Enable graceful stop
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
        return bot;
    };
    const telegramBot = createBot();
    const scheduleMessages = () => {
        const userId = process.env.DEV_USER_ID;
        subscribeAlerts(telegramBot, userId);
    };
    telegramBot.start((ctx) => ctx.reply('Welcome'));
    telegramBot.settings(async (ctx) => {
        const botCommands = getJsonData('commands');
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
//# sourceMappingURL=mainBot.js.map