/* eslint-disable no-undef */
const FIRST_FESTIVAL_DAY = 9;
const DATE_FORMAT = '2026-08-';

const getContainerData = (data) => {
  let hour;
  let day;
  let entry;
  let key;

  document.querySelectorAll('[data-bl-name="Card Content"]').forEach((card) => {
    const dayNodes = Array.from(card.querySelectorAll('[data-bl-name="day"]'));
    const hourNode = dayNodes.find((node) => /^\d{1,2}:\d{2}$/.test(node.innerHTML.trim()));
    const dayNode = dayNodes.find((node) => /^\d{1,2}$/.test(node.innerHTML.trim()));

    hour = hourNode.innerHTML.trim();
    day = dayNode.innerHTML.trim();
    key = `${DATE_FORMAT + day}`;

    entry = {
      name: Array.from(card.querySelectorAll('[data-bl-name="Text"]'))
        .map((node) => node.innerHTML)
        .join('')
        .trim(),
      stage: card.querySelector('[data-bl-name="VENUE"]').innerHTML,
      hour,
      day: new Date(`${DATE_FORMAT + day}`).getDate() + (hour.split(':')[0] < 8 ? 1 : 0),
      url: card.href,
    };

    if (!data[key]) {
      data[key] = [];
    }

    if (!data[key].some((existing) => existing.url === entry.url)) {
      data[key].push(entry);
    }
  });

  return data;
};

const sortData = (data) => {
  Object.keys(data).forEach((key) => {
    data[key].sort((a, b) => {
      if (a.day === b.day) {
        // If the days are the same, sort by hour
        return a.hour.localeCompare(b.hour);
      } else {
        // Otherwise, sort by day
        return a.day - b.day;
      }
    });
  });

  return data;
};

const clickButtons = async () => {
  let data = {};
  const dayButtons = document.querySelectorAll('[data-bl-name="Filter button"]');

  for (let index = 0; index < dayButtons.length; index += 1) {
    data[DATE_FORMAT + String(FIRST_FESTIVAL_DAY + index).padStart(2, '0')] = [];
  }

  for (const dayButton of dayButtons) {
    dayButton.click();

    await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait for 3 seconds

    getContainerData(data);
  }

  sortData(data);

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
