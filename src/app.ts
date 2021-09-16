import mainBot from './bots/mainBot';
import googleAuth from './utils/googleAuth';

const index = () => {
  const { scheduleMessages } = mainBot();

  // Scheduled alert messages for subscribed users
  scheduleMessages();

  const { verifyAutentication } = googleAuth();

  verifyAutentication();
};

index();
