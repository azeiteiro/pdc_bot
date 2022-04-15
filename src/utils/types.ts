export type Concert = {
  name: string;
  stage: string;
  hour: string;
  day: string;
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
  isWriteable: boolean;
  shareInfo: ShareInfo;
  mediaItemsCount: string;
  coverPhotoBaseUrl: string;
  coverPhotoMediaItemId: string;
};

export type AlbumsResponse = {
  albums?: Album[];
  nextPageToken: string;
};

export type credentials = {
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
};

export type newMediaItems = {
  description?: string;
  simpleMediaItem: {
    fileName?: string;
    uploadToken: string;
  };
};

export type mediaUploadObject = {
  albumId: string;
  newMediaItems: newMediaItems[];
  albumPosition?: {
    position: string;
    relativeMediaItemId: string;
  };
};

export type uploadResult = {
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
