import { readFileSync } from 'fs';
import path from 'path';
import googleAuth from './googleAuth';
import logger from './logger';
import { Album, AlbumsResponse, UploadResult } from '../types/types';

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
          .then((res) => {
            const data = res.data as AlbumsResponse;

            if (data.albums) {
              albums = [...albums, ...data.albums];
            }

            return data.nextPageToken ? getAlbums(albums, data.nextPageToken) : albums;
          })
          .catch((err) => {
            logger.error(err);
          }) as Promise<Album[]>,
    );

  const createAlbum = (albumName: string): Promise<string> =>
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
        .then((res) => {
          logger.debug('Album created');
          logger.info(res.data);

          return `Album ${albumName} created`;
        })
        .catch((err) => {
          logger.error(err);

          return 'Error creating album';
        }),
    );

  const getAlbumInfo = (albumId: string): Promise<Album> =>
    oAuth2Client.then((p) =>
      p
        .request({
          url: `https://photoslibrary.googleapis.com/v1/albums/${albumId}`,
          method: 'GET',
          headers: {
            'Content-Type': 'application/octet-stream',
            Authorization: `Bearer ${p.credentials.access_token}`,
          },
        })
        .then((res) => {
          console.log(typeof res);
          logger.debug('Album info');
          logger.info(res.data);

          return res.data as Album;
        })
        .catch((err) => {
          logger.error(err);

          return {} as Album;
        }),
    );

  const savePhoto = (albumId: string, fileName: string): void => {
    const file = readFileSync(fileName);
    const extension = path.parse(fileName).ext;

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
            'X-Goog-Upload-File-Name': `${new Date().getTime()}${extension}`,
          },
          data: file,
        })
        .then((res) => {
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
              logger.info((uploadRes.data as UploadResult).newMediaItemResults);
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

  return { getAlbums, savePhoto, createAlbum, getAlbumInfo };
};

export default googlePhotosAPI;
