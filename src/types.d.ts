declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'staging';
      BOT_DEVELOPMENT_TOKEN: string;
      BOT_STAGING_TOKEN: string;
      BOT_PRODUCTION_TOKEN: string;
      DEV_USER_ID: number;
      ADMIN_IDS: Array<number>;
      BASE_PATH: string;
      GOOGLE_CLIENT_ID: string;
      GOOGLE_CLIENT_SECRET: string;
      GOOGLE_REDIRECT_URL: string;
      UPLOAD_TO_GPHOTOS: boolean;
      ALBUM_ID: string;
      PHOTO_DESCRIPTION: string;
    }
  }
}

export {};
