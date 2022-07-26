import * as dotenv from 'dotenv';
import mainBot from './bots/mainBot';

const index = () => {
  dotenv.config();

  const { scheduleMessages } = mainBot();

  // Scheduled alert messages for subscribed users
  scheduleMessages();
};

index();
