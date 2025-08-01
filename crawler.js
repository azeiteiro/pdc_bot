const FIRST_FESTIVAL_DAY = 10;
const DATE_FORMAT = '2025-08-';

const getContainerData = (data) => {
  let hour;
  let day;
  let entry;
  let key;

  document.querySelectorAll('[data-bl-name="Card Content"]').forEach((card) => {
    hour = card.querySelectorAll('[data-bl-name="day"]')[1].innerHTML;
    day = card.querySelectorAll('[data-bl-name="day"]')[0].innerHTML.match(/\d+/)[0];
    key = `${DATE_FORMAT + day}`;

    entry = {
      name: card.querySelector('[data-bl-name="Text"]').innerHTML,
      stage: card.querySelector('[data-bl-name="VENUE"]').innerHTML,
      hour,
      day: new Date(`${DATE_FORMAT + day}`).getDate() + (hour.split(':')[0] < 12 ? 1 : 0),
      url: card.href,
    };

    data[key].push(entry);
  });

  data[key].sort((a, b) => {
    if (a.day === b.day) {
      // If the days are the same, sort by hour
      return a.hour.localeCompare(b.hour);
    } else {
      // Otherwise, sort by day
      return a.day - b.day;
    }
  });

  return data;
};

const clickButtons = async () => {
  let data = {};
  const dayButtons = document.querySelectorAll('[data-bl-name="Filter button"]');

  for (let index = 0; index < dayButtons.length; index += 1) {
    data[DATE_FORMAT + (FIRST_FESTIVAL_DAY + index)] = [];
  }

  for (const dayButton of dayButtons) {
    dayButton.click();

    await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait for 3 seconds

    getContainerData(data);
  }

  const jsonData = JSON.stringify(data);

  const downloadLink = document.createElement('a');

  downloadLink.setAttribute(
    'href',
    'data:text/plain;charset=utf-8,' + encodeURIComponent(jsonData),
  );
  downloadLink.setAttribute('download', 'lineup.json');

  document.body.appendChild(downloadLink);
  downloadLink.click();

  document.body.removeChild(downloadLink);
};

clickButtons();
