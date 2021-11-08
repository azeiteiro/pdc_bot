import mainBot from './bots/mainBot';
import googlePhotosAPI from './utils/googlePhotosAPI';

const index = () => {
  const { scheduleMessages } = mainBot();

  // Scheduled alert messages for subscribed users
  scheduleMessages();

  const { getAlbuns } = googlePhotosAPI();

  getAlbuns();
};

index();
