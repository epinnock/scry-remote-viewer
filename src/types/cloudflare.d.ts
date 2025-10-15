// Cloudflare Workers type declarations
// These will be properly typed when @cloudflare/workers-types is installed

declare global {
  interface R2Bucket {
    get(key: string): Promise<R2Object | null>;
    head(key: string): Promise<R2Object | null>;
    put(key: string, value: ArrayBuffer | string | ReadableStream | Uint8Array, options?: R2PutOptions): Promise<R2Object>;
    delete(key: string | string[]): Promise<void>;
    list(options?: R2ListOptions): Promise<R2Objects>;
  }

  interface R2Object {
    key: string;
    body: ReadableStream;
    bodyUsed: boolean;
    size: number;
    etag: string;
    httpEtag: string;
    uploaded: Date;
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
    range?: R2Range;
    checksums: R2Checksums;
  }

  interface R2Objects {
    objects: R2Object[];
    truncated: boolean;
    cursor?: string;
    delimitedPrefixes: string[];
  }

  interface R2PutOptions {
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
    md5?: ArrayBuffer | string;
    sha1?: ArrayBuffer | string;
    sha256?: ArrayBuffer | string;
    sha384?: ArrayBuffer | string;
    sha512?: ArrayBuffer | string;
  }

  interface R2HTTPMetadata {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
  }

  interface R2ListOptions {
    limit?: number;
    prefix?: string;
    cursor?: string;
    delimiter?: string;
    startAfter?: string;
    include?: ('httpMetadata' | 'customMetadata')[];
  }

  interface R2Range {
    offset: number;
    length?: number;
    suffix?: number;
  }

  interface R2Checksums {
    md5?: ArrayBuffer;
    sha1?: ArrayBuffer;
    sha256?: ArrayBuffer;
    sha384?: ArrayBuffer;
    sha512?: ArrayBuffer;
  }

  interface KVNamespace {
    get(key: string, options?: { type: 'text' }): Promise<string | null>;
    get(key: string, options: { type: 'json' }): Promise<any | null>;
    get(key: string, options: { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>;
    get(key: string, options: { type: 'stream' }): Promise<ReadableStream | null>;
    put(key: string, value: string | ArrayBuffer | ReadableStream, options?: KVPutOptions): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: KVListOptions): Promise<KVNamespaceListResult>;
  }

  interface KVPutOptions {
    expiration?: number;
    expirationTtl?: number;
    metadata?: any;
  }

  interface KVListOptions {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }

  interface KVNamespaceListResult {
    keys: { name: string; expiration?: number; metadata?: any }[];
    list_complete: boolean;
    cursor?: string;
  }
}

export {};