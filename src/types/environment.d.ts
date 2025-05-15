export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'staging' | 'test';
      BOT_DEVELOPMENT_TOKEN: string;
      BOT_STAGING_TOKEN: string;
      BOT_PRODUCTION_TOKEN: string;
      CHAT_ID: string;
      ADMIN_IDS: string;
      BASE_PATH: string;
      GOOGLE_CLIENT_ID: string;
      GOOGLE_CLIENT_SECRET: string;
      GOOGLE_REDIRECT_URL: string;
      UPLOAD_TO_GPHOTOS: string;
      ALBUM_ID: string;
      ALBUM_URL: string;
      PHOTO_DESCRIPTION: string;
      ACCUWEATHER_API_KEY: string;
    }
  }
}
