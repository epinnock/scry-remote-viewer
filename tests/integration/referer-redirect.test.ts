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

  it('falls through to downstream handlers when no Referer is present', async () => {
    const app = createApp();
    const env = createMockEnv();

    const req = new Request('https://view.scrymore.com/placeholder.svg');
    const res = await app.fetch(req, env as any);

    // The redirect middleware should NOT intercept — it falls through to auth/zip-static.
    expect(res.status).not.toBe(302);
    // Auth middleware treats "placeholder.svg" as a projectId and returns 401
    // (Firestore lookup fails, defaults to private).
    expect(res.status).toBe(401);
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

  it('redirects multi-segment paths when Referer project differs', async () => {
    const app = createApp();
    const env = createMockEnv();

    // /pets/hero-pets.png resolves to project "pets" but Referer is from "TjYmKAiAQuIdYFlBnVOa"
    const req = new Request('https://view.scrymore.com/pets/hero-pets.png', {
      headers: {
        Referer: 'https://view.scrymore.com/TjYmKAiAQuIdYFlBnVOa/main/iframe.html',
      },
    });
    const res = await app.fetch(req, env as any);

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/TjYmKAiAQuIdYFlBnVOa/main/pets/hero-pets.png');
  });

  it('preserves query string in redirect', async () => {
    const app = createApp();
    const env = createMockEnv();

    const req = new Request('https://view.scrymore.com/pets/hero-pets.png?w=640&q=75', {
      headers: {
        Referer: 'https://view.scrymore.com/TjYmKAiAQuIdYFlBnVOa/main/iframe.html',
      },
    });
    const res = await app.fetch(req, env as any);

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/TjYmKAiAQuIdYFlBnVOa/main/pets/hero-pets.png?w=640&q=75');
  });

  it('does not break the /health endpoint', async () => {
    const app = createApp();
    const env = createMockEnv();

    const req = new Request('https://view.scrymore.com/health');
    const res = await app.fetch(req, env as any);

    expect(res.status).toBe(200);
  });
});
