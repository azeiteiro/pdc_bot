import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor, Conversation } from '@grammyjs/conversations';
import { HydrateFlavor } from '@grammyjs/hydrate';
import { I18nFlavor } from '@grammyjs/i18n';

export type Concert = {
  name: string;
  stage: string;
  hour: string;
  day: number;
  url: string;
};

export type FestivalData = {
  [Identifier: string]: Array<Concert>;
};

export type SharedAlbumOptions = {
  isCollaborative: boolean;
  isCommentable: boolean;
};

export type ShareInfo = {
  sharedAlbumOptions: SharedAlbumOptions;
  shareableUrl: string;
  shareToken: string;
  isJoined: boolean;
  isOwned: boolean;
  isJoinable: boolean;
};

export type Album = {
  id: string;
  title: string;
  productUrl: string;
  isWriteable?: boolean;
  shareInfo?: ShareInfo;
  mediaItemsCount: string;
  coverPhotoBaseUrl: string;
  coverPhotoMediaItemId: string;
};

export type AlbumsResponse = {
  albums?: Album[];
  nextPageToken: string;
};

export type Credentials = {
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
};

export type NewMediaItems = {
  description?: string;
  simpleMediaItem: {
    fileName?: string;
    uploadToken: string;
  };
};

export type MediaUploadObject = {
  albumId: string;
  newMediaItems: NewMediaItems[];
  albumPosition?: {
    position: string;
    relativeMediaItemId: string;
  };
};

export type UploadResult = {
  newMediaItemResults: {
    uploadToken: string;
    status: {
      message: string;
    };
    mediaItem?: {
      id: string;
      description: string;
      productUrl: string;
      mimeType: 'mime-type';
      mediaMetadata: {
        width: number;
        height: number;
        creationTime: Date;
        photo: unknown;
      };
      filename: string;
    };
  }[];
};

export type Command = {
  command: string;
  description: string;
  description_pt?: string;
  adminOnly?: boolean;
};

export type Forecast = {
  forecastDate: string;
  tMin: number;
  tMax: number;
  precipitaProb: number;
  idWeatherType: number;
};

export type User = {
  user_id: number;
  telegram_username: string | null;
  name: string | null;
  preferred_language: string | null;
  onboarding_status: string | null;
  created_at: string;
  updated_at: string;
};

export interface SessionData {
  expenseData?: {
    title: string;
    name: string;
    amount: number;
    date: string;
    description?: string;
  };
  preferredLanguage?: 'en' | 'pt';
  pendingBroadcast?: string;
  pendingPinMessageId?: number;
}

// Base context without conversation flavor
type BaseContext = HydrateFlavor<Context> & SessionFlavor<SessionData> & I18nFlavor;

// Full bot context including conversation flavor
export type BotContext = BaseContext & ConversationFlavor<BaseContext>;

// Conversation uses base context (without ConversationFlavor to avoid circular reference)
export type BotConversation = Conversation<BaseContext>;
