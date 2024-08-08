const FIRST_FESTIVAL_DAY = 11;
const DATE_FORMAT = '2024-08-';

const getContainerData = (data) => {
  let hour;
  let day;
  let entry;
  let key;

  document.querySelectorAll('[data-bl-name="Card"]').forEach((card) => {
    hour = card.querySelectorAll('[data-bl-name="Text"]')[2].innerHTML;
    day = card.querySelector('[data-bl-name="day"]').innerHTML.match(/\d+/)[0];
    key = `${DATE_FORMAT + day}`;

    entry = {
      name: card.querySelector('[data-bl-name="Text"]').innerHTML,
      stage: card.querySelector('[data-bl-name="VENUE"]').innerHTML,
      hour: card.querySelectorAll('[data-bl-name="Text"]')[2].innerHTML,
      day: new Date(`${DATE_FORMAT + day}`).getDate() + (hour.split(':')[0] < 12 ? 1 : 0),
      url: card.querySelector('a').href,
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

    // Get the data from the container here
    getContainerData(data);
  }

  // Convert the data object to a JSON string
  const jsonData = JSON.stringify(data);

  // Create a download link
  const downloadLink = document.createElement('a');

  downloadLink.setAttribute(
    'href',
    'data:text/plain;charset=utf-8,' + encodeURIComponent(jsonData),
  );
  downloadLink.setAttribute('download', 'lineup.json');

  // Append the link to the document and click it
  document.body.appendChild(downloadLink);
  downloadLink.click();

  // Remove the link from the document
  document.body.removeChild(downloadLink);
};

clickButtons();
