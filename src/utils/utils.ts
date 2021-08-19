import { readFileSync } from 'fs';
import schedule from 'node-schedule';
import { Telegraf } from 'telegraf';

type Concert = {
  name: string;
  stage: string;
  hour: string;
  day: string;
  url: string;
};

type FestivalData = {
  [Identifier: string]: Array<Concert>;
};
export default () => {
  const concertData: FestivalData = JSON.parse(
    readFileSync(`${__dirname}/../resources/pdc_2019.json`, 'utf8'),
  );

  const subscribeAlerts = (bot: Telegraf, chatId: number) => {
    // Alert time delay in minutes
    const alertTimeDelay = 30;

    Object.keys(concertData).forEach((day) => {
      const dayData = concertData[day];

      dayData.forEach((c) => {
        const text =
          `There will be a concert in ${alertTimeDelay} minutes:\n\n<b>${c.name}</b>\n\n` +
          `<i>Starts at </i><b>${c.hour}</b><i> in </i><b>${c.stage}</b>\n` +
          `<a href="${c.url}">view more info</a>`;

        // Format date and time
        const tempDate = c.day.split('/');
        const announceTime = new Date(`${tempDate[2]}-${tempDate[1]}-${tempDate[0]} ${c.hour}`);

        announceTime.setMinutes(announceTime.getMinutes() - alertTimeDelay);

        schedule.scheduleJob(announceTime, () => {
          bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
        });
      });
    });
  };

  return { subscribeAlerts };
};
