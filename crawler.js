// Simple crawler to get festival schedule in the correct format
const dateFormat = '2022-08-';
const firstDay = 12;
const nDays = 9;
const data = {};
let key;
let hour;
let day;
let entry;

for (let index = 0; index < nDays; index += 1) {
  data[dateFormat + (firstDay + index)] = [];
}

document.querySelectorAll('[data-bl-name="Card"]').forEach((card) => {
  hour = card.querySelectorAll('[data-bl-name="Text"]')[2].innerHTML;

  day = card.querySelector('[data-bl-name="day"]').innerHTML.match(/\d+/)[0];

  entry = {
    name: card.querySelector('[data-bl-name="Text"]').innerHTML,
    stage: card.querySelector('[data-bl-name="VENUE"]').innerHTML,
    hour: card.querySelectorAll('[data-bl-name="Text"]')[2].innerHTML,
    day: new Date(`2022-08-${day}`).getDate() + (hour.split(':')[0] < 12 ? 1 : 0),
    url: card.querySelector('a').href,
  };

  key = `2022-08-${day}`;

  data[key].push(entry);
});

console.log(JSON.stringify(data));