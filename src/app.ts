import mainBot from './bots/mainBot';

const index = () => {
  const { scheduleMessages } = mainBot();

  // Scheduled alert messages for subscribed users
  scheduleMessages();
};

index();
