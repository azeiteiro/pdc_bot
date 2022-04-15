import { readFileSync } from 'fs';
import { GaxiosResponse } from 'googleapis-common';
import googleAuth from './googleAuth';
import logger from './logger';
import { Album, AlbumsResponse, uploadResult } from './types';

const googlePhotosAPI = () => {
  const { getOauth, verifyAutentication } = googleAuth();

  const oAuth2Client = getOauth();

  const getAlbums = async (
    albums = [] as Array<Album>,
    pageToken = '' as string,
  ): Promise<Album[]> =>
    oAuth2Client.then(
      (p) =>
        p
          .request({
            url: `https://photoslibrary.googleapis.com/v1/albums${
              pageToken ? `?pageToken=${pageToken}` : ''
            }`,
          })
          .then((res: GaxiosResponse) => {
            const data = res.data as AlbumsResponse;

            if (data.albums) {
              // eslint-disable-next-line no-param-reassign
              albums = [...albums, ...data.albums];
            }

            return data.nextPageToken ? getAlbums(albums, data.nextPageToken) : albums;
          })
          .catch((err) => {
            logger.error(err);
          }) as Promise<Album[]>,
    );

  const createAlbum = (albumName: string) => {
    oAuth2Client.then((p) =>
      p
        .request({
          url: `https://photoslibrary.googleapis.com/v1/albums`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            Authorization: `Bearer ${p.credentials.access_token}`,
          },
          data: {
            album: {
              title: albumName,
              isWriteable: true,
            },
          },
        })
        .then((res: GaxiosResponse) => {
          logger.debug('Media uploaded');
          logger.info(res.data);
        })
        .catch((err) => {
          logger.error(err);
        }),
    );
  };

  const savePhoto = (albumId: string, fileName: string): void => {
    const file = readFileSync(fileName);

    oAuth2Client.then((p) =>
      p
        .request({
          url: 'https://photoslibrary.googleapis.com/v1/uploads',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${p.credentials.access_token}`,
            'Content-type': 'application/octet-stream',
            'X-Goog-Upload-Content-Type': 'mime-type',
            'X-Goog-Upload-Protocol': 'raw',
            'X-Goog-Upload-File-Name': fileName,
          },
          data: file,
        })
        .then((res: GaxiosResponse) => {
          p.request({
            url: 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
            method: 'POST',
            headers: {
              'Content-type': 'application/json',
              Authorization: `Bearer ${p.credentials.access_token}`,
            },
            data: {
              albumId,
              newMediaItems: [
                {
                  description: process.env.PHOTO_DESCRIPTION,
                  simpleMediaItem: {
                    uploadToken: res.data,
                  },
                },
              ],
            },
          })
            .then((uploadRes) => {
              logger.info((uploadRes.data as uploadResult).newMediaItemResults);
            })
            .catch((err) => {
              logger.error(`Media upload error: ${err}`);
            });
        })
        .catch((err) => {
          logger.error(`Error retriving upload token: ${err}`);
          verifyAutentication();
        }),
    );
  };

  return { getAlbums, savePhoto, createAlbum };
};

export default googlePhotosAPI;
