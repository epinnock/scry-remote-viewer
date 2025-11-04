// Environment types for both Cloudflare Workers and Docker

export interface Env {
  // Cloudflare Workers bindings
  STATIC_SITES?: R2Bucket;
  UPLOAD_BUCKET?: R2Bucket;  // NEW: Upload Service bucket
  CDN_CACHE?: KVNamespace;

  // Common environment variables
  PLATFORM?: 'cloudflare' | 'docker';
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_SERVICE_ACCOUNT?: string;
  FIREBASE_API_KEY?: string;

  // Docker/R2 specific
  STORAGE_TYPE?: 'r2' | 'filesystem';
  STORAGE_PATH?: string;
  R2_BUCKET?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;

  // Cache
  REDIS_URL?: string;
  CACHE_TTL?: string;

  // Server
  PORT?: string;
  NODE_ENV?: 'development' | 'production' | 'test';
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';

  // CDN
  ALLOWED_ORIGINS?: string;
  MAX_FILE_SIZE?: string;
  CACHE_CONTROL?: string;
  BASE_DOMAIN?: string;
  SUBDOMAIN_PATTERN?: string;

  // ZIP Extraction Configuration
  ZIP_EXTRACTION_ENABLED?: string;
  ZIP_CACHE_TTL?: string;
  ZIP_MAX_FILE_SIZE?: string;
}

export interface CloudflareEnv extends Env {
  STATIC_SITES: R2Bucket;
  UPLOAD_BUCKET: R2Bucket;  // NEW: Upload Service bucket (required in Cloudflare)
  CDN_CACHE: KVNamespace;
  PLATFORM: 'cloudflare';
}

export interface DockerEnv extends Env {
  PLATFORM: 'docker';
  STORAGE_TYPE: 'r2' | 'filesystem';
}