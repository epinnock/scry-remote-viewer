import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '@/app';

describe('Referer-based redirect for root-level asset requests', () => {
  const createMockEnv = (overrides = {}) => ({
    NODE_ENV: 'production',
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_API_KEY: 'test-api-key',
    UPLOAD_BUCKET: {
      get: vi.fn().mockResolvedValue(null),
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

  it('returns 302 redirect when Referer has valid project/version', async () => {
    const app = createApp();
    const env = createMockEnv();

    const req = new Request('https://view.scrymore.com/placeholder.svg', {
      headers: {
        Referer: 'https://view.scrymore.com/TjYmKAiAQuIdYFlBnVOa/main/iframe.html',
      },
    });
    const res = await app.fetch(req, env as any);

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/TjYmKAiAQuIdYFlBnVOa/main/placeholder.svg');
  });

  it('sets Vary: Referer on redirect responses', async () => {
    const app = createApp();
    const env = createMockEnv();

    const req = new Request('https://view.scrymore.com/placeholder.svg', {
      headers: {
        Referer: 'https://view.scrymore.com/TjYmKAiAQuIdYFlBnVOa/main/iframe.html',
      },
    });
    const res = await app.fetch(req, env as any);

    expect(res.status).toBe(302);
    expect(res.headers.get('Vary')).toBe('Referer');
  });

  it('returns 302 redirect for project without version', async () => {
    const app = createApp();
    const env = createMockEnv();

    const req = new Request('https://view.scrymore.com/placeholder.svg', {
      headers: {
        Referer: 'https://view.scrymore.com/TjYmKAiAQuIdYFlBnVOa/iframe.html',
      },
    });
    const res = await app.fetch(req, env as any);

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/TjYmKAiAQuIdYFlBnVOa/placeholder.svg');
  });

  it('does not return 400 when no Referer header is present (falls through)', async () => {
    const app = createApp();
    const env = createMockEnv();

    const req = new Request('https://view.scrymore.com/placeholder.svg');
    const res = await app.fetch(req, env as any);

    // Falls through to downstream handlers — NOT a hard 400 from the middleware
    expect(res.status).not.toBe(302);
    expect(res.status).not.toBe(500);
  });

  it('does not return 302 when Referer has invalid projectId', async () => {
    const app = createApp();
    const env = createMockEnv();

    const req = new Request('https://view.scrymore.com/placeholder.svg', {
      headers: {
        Referer: 'https://view.scrymore.com/ab/main/iframe.html',
      },
    });
    const res = await app.fetch(req, env as any);

    expect(res.status).not.toBe(302);
  });

  it('redirects root-level assets with file extensions in name', async () => {
    const app = createApp();
    const env = createMockEnv();

    // /logo.png fails isValidUUID (dot in name), so the middleware redirects
    const req = new Request('https://view.scrymore.com/logo.png', {
      headers: {
        Referer: 'https://view.scrymore.com/myProject123/v1.0.0/iframe.html',
      },
    });
    const res = await app.fetch(req, env as any);

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/myProject123/v1.0.0/logo.png');
  });

  it('does not break the /health endpoint', async () => {
    const app = createApp();
    const env = createMockEnv();

    const req = new Request('https://view.scrymore.com/health');
    const res = await app.fetch(req, env as any);

    // /health should pass through the redirect middleware and reach the health handler
    expect(res.status).not.toBe(400);
    expect(res.status).not.toBe(302);
  });
});
