import { GaxiosResponse } from 'googleapis-common';
import googleAuth from './googleAuth';
import { Album, AlbumsResponse } from './types';

const googlePhotosAPI = () => {
  const { getOauth } = googleAuth();

  const oAuth2Client = getOauth();

  const getAlbuns = (albums: Array<Album>, pageToken: string): Promise<Album[]> =>
    oAuth2Client.then(
      (p) =>
        p
          .request({
            url: `https://photoslibrary.googleapis.com/v1/albums${
              pageToken ? `?pageToken=${pageToken}` : ''
            }`,
          })
          // eslint-disable-next-line consistent-return
          .then((res: GaxiosResponse) => {
            const data = res.data as AlbumsResponse;

            if (data.albums) {
              // eslint-disable-next-line no-param-reassign
              albums = [...albums, ...data.albums];
            }

            return data.nextPageToken ? getAlbuns(albums, data.nextPageToken) : albums;
          })
          .catch((err) => {
            console.error(err);
          }) as Promise<Album[]>,
    );

  return { getAlbuns };
};

export default googlePhotosAPI;
