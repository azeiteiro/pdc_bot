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
