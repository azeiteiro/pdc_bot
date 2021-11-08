import googleAuth from './googleAuth';

const googlePhotosAPI = () => {
  const { getOauth } = googleAuth();

  console.log('antes');
  getOauth();
  console.log('depois');
  const getAlbuns = () => {
    console.log('cenas');

    // oAuth2Client
    //   .request({ url: 'https://photoslibrary.googleapis.com/v1/albums' })
    //   .then((res) => {
    //     console.log(res);
    //   })
    //   .catch((err) => {
    //     console.error(err);
    //   });
  };

  return { getAlbuns };
};

export default googlePhotosAPI;
