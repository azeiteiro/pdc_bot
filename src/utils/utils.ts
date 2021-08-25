import axios from 'axios';
import { readFileSync, createWriteStream } from 'fs';
import schedule from 'node-schedule';
import { Context, Telegraf } from 'telegraf';
import { cwd } from 'process';

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

  const saveFile = (fileId: string, ctx: Context) => {
    ctx.telegram.getFileLink(fileId).then((url) =>
      axios
        .get(url.toString(), { responseType: 'stream' })
        .then(
          (response) =>
            new Promise(() =>
              response.data
                .pipe(createWriteStream(`${cwd()}/downloads/photos/${fileId}.jpg`))
                .on('finish', () => console.log('deu'))
                .on('error', (e: Error) => console.log(e)),
            ),
        )
        .catch((error) => {
          // handle error
          console.log(error);
        }),
    );
  };

  const getLineup = (weekDay: string) =>
    concertData[weekDay]
      .map((concert) => `<i>${concert.hour}</i>: <b>${concert.name}</b> - ${concert.stage}\n`)
      .join();

  return { subscribeAlerts, getLineup, saveFile };
};
