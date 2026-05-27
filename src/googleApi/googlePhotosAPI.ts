import { readFileSync } from 'fs';
import path from 'path';
import logger, { loggers } from '../utils/logger.js';
import type { Album, AlbumsResponse, UploadResult } from '../types/types.js';
import { getOAuth2Client } from './googleAuth.js';

export const getAlbums = async (
  albums = [] as Array<Album>,
  pageToken = '' as string,
): Promise<Album[]> => {
  const authClient = await getOAuth2Client();

  return authClient
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

      return albums;
    });
};

export const createAlbum = async (albumName: string): Promise<string> => {
  const authClient = await getOAuth2Client();

  return authClient
    .request({
      url: `https://photoslibrary.googleapis.com/v1/albums`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authClient.credentials.access_token}`,
      },
      data: {
        album: {
          title: albumName,
        },
      },
    })
    .then((res) => {
      const data = res.data as Album;

      logger.debug('Album created');
      logger.info(res.data);

      return (
        `Album ${data.title} created\n` +
        `URL: ${data.productUrl}\n` +
        `ID: ${data.id}\n` +
        `Writeable: ${data.isWriteable}`
      );
    })
    .catch((err: unknown) => {
      logger.error(err);

      return 'Error creating album';
    });
};

export const getAlbumInfo = async (albumId: string): Promise<Album> => {
  const authClient = await getOAuth2Client();

  return authClient
    .request({
      url: `https://photoslibrary.googleapis.com/v1/albums/${albumId}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authClient.credentials.access_token}`,
      },
    })
    .then((res) => {
      logger.debug('Album info');
      logger.info(res.data);

      return res.data as Album;
    })
    .catch((error) => {
      loggers.errorWithContext(error as Error, 'Google Photos API');

      return {} as Album;
    });
};

export const savePhoto = async (albumId: string, fileName: string): Promise<void> => {
  const file = readFileSync(fileName);
  const extension = path.parse(fileName).ext.toLowerCase();

  // Basic MIME type detection based on standard extensions
  let mimeType = 'application/octet-stream';

  if (['.jpg', '.jpeg'].includes(extension)) mimeType = 'image/jpeg';
  else if (extension === '.png') mimeType = 'image/png';
  else if (extension === '.mp4') mimeType = 'video/mp4';
  else if (extension === '.mov') mimeType = 'video/quicktime';

  const authClient = await getOAuth2Client();

  return authClient
    .request({
      url: 'https://photoslibrary.googleapis.com/v1/uploads',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authClient.credentials.access_token}`,
        'Content-type': 'application/octet-stream',
        'X-Goog-Upload-Content-Type': mimeType,
        'X-Goog-Upload-Protocol': 'raw',
      },
      data: file,
    })
    .then((res) => {
      return authClient
        .request({
          url: 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
          method: 'POST',
          headers: {
            'Content-type': 'application/json',
            Authorization: `Bearer ${authClient.credentials.access_token}`,
          },
          data: {
            albumId,
            newMediaItems: [
              {
                description: process.env.PHOTO_DESCRIPTION,
                simpleMediaItem: {
                  uploadToken: res.data,
                  fileName: `${new Date().getTime()}${extension}`,
                },
              },
            ],
          },
        })
        .then((uploadRes) => {
          logger.info((uploadRes.data as UploadResult).newMediaItemResults);
        })
        .catch((error) => {
          loggers.errorWithContext(error as Error, 'Google Photos API');
        });
    })
    .catch((error) => {
      loggers.errorWithContext(error as Error, 'Google Photos API');
    });
};
