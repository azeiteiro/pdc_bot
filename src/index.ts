import mainBot from './bots/mainBot';
import googlePhotos from './utils/googleAuth';

const devMode = true;

const index = () => {
  const { scheduleMessages } = mainBot(devMode);

  // Scheduled alert messages for subscribed users
  scheduleMessages();

  const { authenticateWithBrowser } = googlePhotos();

  authenticateWithBrowser();
};

index();
