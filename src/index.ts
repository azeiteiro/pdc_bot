import mainBot from './bots/main_bot';

const devMode = true;

const index = () => {
  const { scheduleMessages } = mainBot(devMode);

  scheduleMessages();
};

index();
