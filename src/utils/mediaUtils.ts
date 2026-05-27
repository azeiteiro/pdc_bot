import { Readable } from 'stream';
import { createWriteStream, mkdir, access } from 'fs';
import { cwd } from 'process';
import { Context } from 'grammy';
import { fetchStream } from './http.js';
import { savePhoto } from '../googleApi/googlePhotosAPI.js';
import { loggers } from './logger.js';

// Creates /downloads/photos, regardless of whether `/downloads` and /downloads/photos exist.
access('/downloads/photos', (error) => {
  if (error) {
    mkdir(`${cwd()}/downloads/photos`, { recursive: true }, (err) => {
      if (err) {
        throw err;
      }
    });
  }
});

export const saveFile = async (fileId: string, fileExtension: string, ctx: Context) => {
  const filePath = `${cwd()}/downloads/photos/${fileId}.${fileExtension}`;

  try {
    const file = await ctx.api.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${process.env.BOT_DEVELOPMENT_TOKEN || process.env.BOT_PRODUCTION_TOKEN}/${file.file_path}`;

    const stream = await fetchStream(url);
    const nodeStream = Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]);

    nodeStream.pipe(createWriteStream(filePath)).on('finish', () => {
      if (`${process.env.UPLOAD_TO_GPHOTOS}` === 'true') {
        savePhoto(process.env.ALBUM_ID!, filePath);
      }
    });
  } catch (error) {
    loggers.errorWithContext(error as Error, 'saveFile');
  }
};
