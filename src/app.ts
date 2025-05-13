import 'dotenv/config';
import { scheduleMessages } from './bots/mainBot.ts';

const index = () => {
  // Scheduled alert messages for subscribed users
  scheduleMessages();
};

index();
