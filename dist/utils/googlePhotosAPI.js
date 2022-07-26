"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const googleAuth_1 = __importDefault(require("./googleAuth"));
const logger_1 = __importDefault(require("./logger"));
const googlePhotosAPI = () => {
    const { getOauth, verifyAutentication } = (0, googleAuth_1.default)();
    const oAuth2Client = getOauth();
    const getAlbums = async (albums = [], pageToken = '') => oAuth2Client.then((p) => p
        .request({
        url: `https://photoslibrary.googleapis.com/v1/albums${pageToken ? `?pageToken=${pageToken}` : ''}`,
    })
        .then((res) => {
        const data = res.data;
        if (data.albums) {
            // eslint-disable-next-line no-param-reassign
            albums = [...albums, ...data.albums];
        }
        return data.nextPageToken ? getAlbums(albums, data.nextPageToken) : albums;
    })
        .catch((err) => {
        logger_1.default.error(err);
    }));
    const createAlbum = (albumName) => oAuth2Client.then((p) => p
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
        logger_1.default.debug('Album created');
        logger_1.default.info(res.data);
        return `Album ${albumName} created`;
    })
        .catch((err) => {
        logger_1.default.error(err);
        return 'Error creating album';
    }));
    const getAlbumInfo = (albumId) => oAuth2Client.then((p) => p
        .request({
        url: `https://photoslibrary.googleapis.com/v1/albums/${albumId}`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/octet-stream',
            Authorization: `Bearer ${p.credentials.access_token}`,
        },
    })
        .then((res) => {
        logger_1.default.debug('Album info');
        logger_1.default.info(res.data);
        return res.data;
    })
        .catch((err) => {
        logger_1.default.error(err);
        return 'Error getting album info';
    }));
    const savePhoto = (albumId, fileName) => {
        const file = (0, fs_1.readFileSync)(fileName);
        oAuth2Client.then((p) => p
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
                logger_1.default.info(uploadRes.data.newMediaItemResults);
            })
                .catch((err) => {
                logger_1.default.error(`Media upload error: ${err}`);
            });
        })
            .catch((err) => {
            logger_1.default.error(`Error retriving upload token: ${err}`);
            verifyAutentication();
        }));
    };
    return { getAlbums, savePhoto, createAlbum, getAlbumInfo };
};
exports.default = googlePhotosAPI;
//# sourceMappingURL=googlePhotosAPI.js.map