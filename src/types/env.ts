// Environment types for both Cloudflare Workers and Docker

export interface Env {
  // Cloudflare Workers bindings
  STATIC_SITES?: R2Bucket;
  CDN_CACHE?: KVNamespace;

  // Common environment variables
  PLATFORM?: 'cloudflare' | 'docker';
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_SERVICE_ACCOUNT?: string;
  FIREBASE_API_KEY?: string;

  // Docker/AWS specific
  STORAGE_TYPE?: 'r2' | 's3' | 'filesystem';
  STORAGE_PATH?: string;
  AWS_S3_BUCKET?: string;
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;

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
}

export interface CloudflareEnv extends Env {
  STATIC_SITES: R2Bucket;
  CDN_CACHE: KVNamespace;
  PLATFORM: 'cloudflare';
}

export interface DockerEnv extends Env {
  PLATFORM: 'docker';
  STORAGE_TYPE: 's3' | 'filesystem';
}