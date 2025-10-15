import type { StorageAdapter, StorageObject, PutOptions, ListOptions, StorageListResult } from './interface';

// R2 Storage Adapter for Cloudflare Workers
export class R2StorageAdapter implements StorageAdapter {
  constructor(private bucket: R2Bucket) {}

  async get(key: string): Promise<StorageObject | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;

    return {
      body: object.body,
      metadata: object.customMetadata,
      contentType: object.httpMetadata?.contentType,
      size: object.size,
      etag: object.httpEtag,
    };
  }

  async put(key: string, value: ArrayBuffer | string | Uint8Array, options?: PutOptions): Promise<void> {
    const httpMetadata: Record<string, string> = {};
    
    if (options?.contentType) {
      httpMetadata.contentType = options.contentType;
    }
    
    if (options?.cacheControl) {
      httpMetadata.cacheControl = options.cacheControl;
    }

    await this.bucket.put(key, value, {
      customMetadata: options?.metadata,
      httpMetadata: Object.keys(httpMetadata).length > 0 ? httpMetadata : undefined,
    });
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async list(prefix: string, options?: ListOptions): Promise<StorageListResult> {
    const listed = await this.bucket.list({
      prefix,
      limit: options?.limit,
      cursor: options?.cursor,
    });

    return {
      keys: listed.objects.map(obj => obj.key),
      cursor: listed.cursor,
      truncated: listed.truncated,
    };
  }

  async exists(key: string): Promise<boolean> {
    const object = await this.bucket.head(key);
    return object !== null;
  }
}