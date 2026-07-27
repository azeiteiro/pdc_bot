import { Readable } from 'stream';
import { createWriteStream, mkdirSync } from 'fs';
import { cwd } from 'process';
import { Context } from 'grammy';
import { fetchStream } from './http.js';
import { savePhoto } from '../googleApi/googlePhotosAPI.js';
import { loggers } from './logger.js';

const downloadsDir = `${cwd()}/downloads/photos`;

// Ensures the downloads directory exists. Errors are logged rather than thrown,
// since an uncaught error here would crash the whole bot process via app.ts's
// uncaughtException handler.
export const ensureDownloadsDir = (): void => {
  try {
    mkdirSync(downloadsDir, { recursive: true });
  } catch (error) {
    loggers.errorWithContext(error as Error, 'ensureDownloadsDir');
  }
};

ensureDownloadsDir();

export const saveFile = async (fileId: string, fileExtension: string, ctx: Context) => {
  const filePath = `${downloadsDir}/${fileId}.${fileExtension}`;

  try {
    const file = await ctx.api.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${process.env.BOT_DEVELOPMENT_TOKEN || process.env.BOT_PRODUCTION_TOKEN}/${file.file_path}`;

    const stream = await fetchStream(url);
    const nodeStream = Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]);
    const writeStream = createWriteStream(filePath);

    writeStream.on('error', (error) => {
      loggers.errorWithContext(error as Error, 'saveFile');
    });

    nodeStream.pipe(writeStream).on('finish', () => {
      if (`${process.env.UPLOAD_TO_GPHOTOS}` === 'true') {
        savePhoto(process.env.ALBUM_ID!, filePath);
      }
    });
  } catch (error) {
    loggers.errorWithContext(error as Error, 'saveFile');
  }
};
