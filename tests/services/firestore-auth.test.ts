import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getFirestoreAccessToken, isServiceAccountConfigured } from '@/services/firestore-auth';

describe('firestore-auth', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('isServiceAccountConfigured', () => {
    it('returns true when both credentials are set', () => {
      const env = {
        FIREBASE_CLIENT_EMAIL: 'test@project.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      };

      expect(isServiceAccountConfigured(env as any)).toBe(true);
    });

    it('returns false when client email is missing', () => {
      const env = {
        FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      };

      expect(isServiceAccountConfigured(env as any)).toBe(false);
    });

    it('returns false when private key is missing', () => {
      const env = {
        FIREBASE_CLIENT_EMAIL: 'test@project.iam.gserviceaccount.com',
      };

      expect(isServiceAccountConfigured(env as any)).toBe(false);
    });

    it('returns false when both credentials are missing', () => {
      const env = {};

      expect(isServiceAccountConfigured(env as any)).toBe(false);
    });

    it('returns false for empty strings', () => {
      const env = {
        FIREBASE_CLIENT_EMAIL: '',
        FIREBASE_PRIVATE_KEY: '',
      };

      expect(isServiceAccountConfigured(env as any)).toBe(false);
    });
  });

  describe('getFirestoreAccessToken', () => {
    it('returns null when credentials are not configured', async () => {
      const env = {
        CDN_CACHE: {
          get: vi.fn(),
          put: vi.fn(),
        },
      };

      const result = await getFirestoreAccessToken(env as any);

      expect(result).toBeNull();
    });

    it('returns cached token when available and not expired', async () => {
      const cachedToken = {
        accessToken: 'cached-access-token',
        expiresAt: Date.now() + 3600 * 1000, // 1 hour from now
      };

      const env = {
        FIREBASE_CLIENT_EMAIL: 'test@project.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
        CDN_CACHE: {
          get: vi.fn().mockResolvedValue(cachedToken),
          put: vi.fn(),
        },
      };

      const result = await getFirestoreAccessToken(env as any);

      expect(result).toBe('cached-access-token');
      expect(env.CDN_CACHE.get).toHaveBeenCalledWith('firestore:access_token', 'json');
    });

    it('returns null when token generation fails with invalid key', async () => {
      const env = {
        FIREBASE_CLIENT_EMAIL: 'test@project.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: 'invalid-key-format',
        CDN_CACHE: {
          get: vi.fn().mockResolvedValue(null),
          put: vi.fn(),
        },
      };

      const result = await getFirestoreAccessToken(env as any);

      expect(result).toBeNull();
    });

    it('returns null when cache read fails gracefully', async () => {
      const env = {
        FIREBASE_CLIENT_EMAIL: 'test@project.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: 'invalid-key',
        CDN_CACHE: {
          get: vi.fn().mockRejectedValue(new Error('KV error')),
          put: vi.fn(),
        },
      };

      // Should not throw, should return null due to invalid key
      const result = await getFirestoreAccessToken(env as any);
      expect(result).toBeNull();
    });

    it('works without CDN_CACHE', async () => {
      const env = {
        FIREBASE_CLIENT_EMAIL: 'test@project.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: 'invalid-key',
        // No CDN_CACHE
      };

      // Should not throw
      const result = await getFirestoreAccessToken(env as any);
      expect(result).toBeNull();
    });
  });
});
