import mainBot from './bots/main_bot';
import googlePhotos from './utils/google_photos';

const devMode = true;

const index = () => {
  const { scheduleMessages } = mainBot(devMode);

  // Scheduled alert messages for subscribed users
  // scheduleMessages();

  const { authenticateWithBrowser } = googlePhotos();

  authenticateWithBrowser();
};

index();
