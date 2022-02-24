import mainBot from './bots/mainBot';
import googlePhotosAPI from './utils/googlePhotosAPI';

const index = () => {
  const { scheduleMessages } = mainBot();

  // Scheduled alert messages for subscribed users
  scheduleMessages();

  const { getAlbuns } = googlePhotosAPI();

  const albums = getAlbuns([], '');

  console.log('result');
  albums.then((p) => console.log(p.forEach((album) => console.log(album.title))));
};

index();
