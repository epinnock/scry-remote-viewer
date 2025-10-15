// Storage adapter types

export interface StorageObject {
  body: ReadableStream | ArrayBuffer | Uint8Array | Buffer;
  metadata?: Record<string, string>;
  contentType?: string;
  size?: number;
  etag?: string;
}

export interface StorageAdapter {
  get(key: string): Promise<StorageObject | null>;
  put(key: string, value: ArrayBuffer | string | Uint8Array, options?: PutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string, options?: ListOptions): Promise<StorageListResult>;
  exists(key: string): Promise<boolean>;
}

export interface PutOptions {
  metadata?: Record<string, string>;
  contentType?: string;
  cacheControl?: string;
}

export interface ListOptions {
  limit?: number;
  cursor?: string;
}

export interface StorageListResult {
  keys: string[];
  cursor?: string;
  truncated: boolean;
}

// Cache adapter types
export interface CacheAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}