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
  const storageType = env.STORAGE_TYPE || 'r2';

  if (storageType === 'filesystem') {
    const storagePath = env.STORAGE_PATH || '/data/static-sites';
    return new FilesystemStorageAdapter(storagePath);
  }

  if (storageType === 'r2') {
    // R2 adapter would be imported here for Docker/Node.js environments
    // This would use the R2 REST API with credentials
    // return new R2APIStorageAdapter(...);
    throw new Error('R2 storage adapter for Docker not yet implemented. Use Cloudflare Workers with R2 binding or filesystem storage.');
  }

  throw new Error(`Unsupported storage type: ${storageType}`);
}