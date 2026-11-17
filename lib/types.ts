export type CardRecord = {
  code: string;
  storeName: string;
  googleReviewUrl: string;
  createdAt: string;
  updatedAt?: string;
  tapCount?: number;
  price?: number;
  cost?: number;
};

export type TapLogEntry = {
  code: string;
  storeName: string;
  tappedAt: string;
};
