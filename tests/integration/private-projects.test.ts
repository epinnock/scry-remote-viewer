import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '@/app';

describe('Private Projects Integration', () => {
  const createMockEnv = (overrides = {}) => ({
    NODE_ENV: 'production',
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_API_KEY: 'test-api-key',
    UPLOAD_BUCKET: {
      get: vi.fn().mockResolvedValue({
        body: new ReadableStream(),
        httpMetadata: { contentType: 'application/json' },
      }),
    },
    CDN_CACHE: {
      get: vi.fn(),
      put: vi.fn(),
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Public Projects', () => {
    it('serves content without authentication', async () => {
      const app = createApp();
      const env = createMockEnv();

      env.CDN_CACHE.get.mockResolvedValue({
        visibility: 'public',
        memberIds: [],
        cachedAt: Date.now(),
      });

      const req = new Request(
        'https://view.scrymore.com/public-project/v1/coverage-report.json'
      );
      const res = await app.fetch(req, env as any);

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('does not require Cookie header', async () => {
      const app = createApp();
      const env = createMockEnv();

      env.CDN_CACHE.get.mockResolvedValue({
        visibility: 'public',
        memberIds: [],
        cachedAt: Date.now(),
      });

      const req = new Request(
        'https://view.scrymore.com/public-project/v1/coverage-report.json'
      );
      const res = await app.fetch(req, env as any);

      expect(res.status).not.toBe(401);
    });
  });

  describe('Private Projects', () => {
    it('returns 401 without session cookie', async () => {
      const app = createApp();
      const env = createMockEnv();

      env.CDN_CACHE.get.mockResolvedValue({
        visibility: 'private',
        memberIds: ['user-123'],
        cachedAt: Date.now(),
      });

      const req = new Request(
        'https://view.scrymore.com/private-project/v1/coverage-report.json'
      );
      const res = await app.fetch(req, env as any);

      expect(res.status).toBe(401);
      expect(await res.text()).toBe('Unauthorized');
    });

    it('returns 401 with invalid session cookie', async () => {
      const app = createApp();
      const env = createMockEnv();

      env.CDN_CACHE.get.mockResolvedValue({
        visibility: 'private',
        memberIds: ['user-123'],
        cachedAt: Date.now(),
      });

      const req = new Request(
        'https://view.scrymore.com/private-project/v1/coverage-report.json',
        {
          headers: { Cookie: '__session=invalid-jwt' },
        }
      );
      const res = await app.fetch(req, env as any);

      expect(res.status).toBe(401);
    });
  });

  describe('CORS with Private Projects', () => {
    it('handles OPTIONS preflight for private projects', async () => {
      const app = createApp();
      const env = createMockEnv();

      const req = new Request(
        'https://view.scrymore.com/private-project/v1/coverage-report.json',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://dashboard.scrymore.com',
            'Access-Control-Request-Method': 'GET',
          },
        }
      );

      const res = await app.fetch(req, env as any);

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://dashboard.scrymore.com'
      );
    });
  });

  describe('Caching', () => {
    it('caches visibility lookup in KV', async () => {
      const app = createApp();
      const env = createMockEnv();

      env.CDN_CACHE.get.mockResolvedValueOnce(null);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            fields: {
              visibility: { stringValue: 'public' },
              memberIds: { arrayValue: { values: [] } },
            },
          }),
      });

      const req = new Request('https://view.scrymore.com/project/v1/coverage-report.json');
      await app.fetch(req, env as any);

      expect(env.CDN_CACHE.put).toHaveBeenCalledWith(
        'visibility:project',
        expect.any(String),
        expect.objectContaining({ expirationTtl: 300 })
      );
    });
  });
});
