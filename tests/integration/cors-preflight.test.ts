import { describe, it, expect, vi } from 'vitest';
import { createApp } from '@/app';

describe('CORS preflight integration', () => {
  it('responds to OPTIONS with 204 and correct CORS headers', async () => {
    const app = createApp();

    const env: any = {
      NODE_ENV: 'production',
      UPLOAD_BUCKET: {
        // Should not be called for preflight
        get: vi.fn(async () => {
          throw new Error('bucket.get should not be called during OPTIONS');
        })
      },
      CDN_CACHE: {}
    };

    const req = new Request('https://view.scrymore.com/test-project/v1.0.0/coverage-report.json', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://dashboard.scrymore.com',
        'Access-Control-Request-Method': 'GET'
      }
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://dashboard.scrymore.com');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS');
  });

  it('falls back to wildcard for unknown origins', async () => {
    const app = createApp();

    const env: any = {
      NODE_ENV: 'production',
      UPLOAD_BUCKET: { get: vi.fn(async () => null) },
      CDN_CACHE: {}
    };

    const req = new Request('https://view.scrymore.com/test-project/v1.0.0/coverage-report.json', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://unknown.example',
        'Access-Control-Request-Method': 'GET'
      }
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
