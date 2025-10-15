import type { StorageAdapter } from './interface';
import { R2StorageAdapter } from './r2';
import { FilesystemStorageAdapter } from './filesystem';
import type { Env } from '@/types/env';

export function createStorageAdapter(env: Env): StorageAdapter {
  // Cloudflare Workers environment (R2)
  if (env.STATIC_SITES) {
    return new R2StorageAdapter(env.STATIC_SITES);
  }

  // Docker/Node.js environment
  const storageType = env.STORAGE_TYPE || 's3';

  if (storageType === 'filesystem') {
    const storagePath = env.STORAGE_PATH || '/data/static-sites';
    return new FilesystemStorageAdapter(storagePath);
  }

  if (storageType === 's3') {
    // S3 adapter would be imported here
    // return new S3StorageAdapter(...);
    throw new Error('S3 storage adapter not yet implemented. Use filesystem or R2.');
  }

  throw new Error(`Unsupported storage type: ${storageType}`);
}