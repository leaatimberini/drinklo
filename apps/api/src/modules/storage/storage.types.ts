export type StoragePutInput = {
  key: string;
  body: Buffer;
  contentType?: string;
  cacheControl?: string;
};

export type StoragePutResult = {
  key: string;
  etag?: string;
};

export type StorageListItem = {
  key: string;
  lastModified?: Date;
  size?: number;
};

export interface StorageAdapter {
  put(input: StoragePutInput): Promise<StoragePutResult>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  list?(prefix: string): Promise<StorageListItem[]>;
  publicUrl?(key: string): string;
}
