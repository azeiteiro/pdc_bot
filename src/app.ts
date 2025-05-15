import 'dotenv/config';
import { scheduleMessages } from './bots/mainBot.js';

const index = () => {
  // Scheduled alert messages for subscribed users
  console.log('Starting scheduled messages');
  scheduleMessages();
};

index();
