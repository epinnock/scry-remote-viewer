import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProjectVisibility, isProjectMember } from '@/services/visibility';

// Mock the firestore-auth module
vi.mock('@/services/firestore-auth', () => ({
  getFirestoreAccessToken: vi.fn(),
  isServiceAccountConfigured: vi.fn(),
}));

import { getFirestoreAccessToken, isServiceAccountConfigured } from '@/services/firestore-auth';

describe('isProjectMember', () => {
  it('returns true when uid is in memberIds', () => {
    expect(isProjectMember(['user-1', 'user-2', 'user-3'], 'user-2')).toBe(true);
  });

  it('returns false when uid is not in memberIds', () => {
    expect(isProjectMember(['user-1', 'user-2'], 'user-3')).toBe(false);
  });

  it('returns false for empty memberIds', () => {
    expect(isProjectMember([], 'user-1')).toBe(false);
  });
});

describe('getProjectVisibility', () => {
  const mockEnv = {
    FIREBASE_PROJECT_ID: 'test-project',
    CDN_CACHE: {
      get: vi.fn(),
      put: vi.fn(),
    },
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to no service account configured (unauthenticated mode)
    (isServiceAccountConfigured as any).mockReturnValue(false);
    (getFirestoreAccessToken as any).mockResolvedValue(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns cached visibility when cache is fresh', async () => {
    const cachedData = {
      visibility: 'private',
      memberIds: ['user-123'],
      cachedAt: Date.now(),
    };

    mockEnv.CDN_CACHE.get.mockResolvedValue(cachedData);

    const result = await getProjectVisibility('project-123', mockEnv as any);

    expect(result).toEqual({
      visibility: 'private',
      memberIds: ['user-123'],
    });
    expect(mockEnv.CDN_CACHE.get).toHaveBeenCalledWith(
      'visibility:project-123',
      'json'
    );
  });

  it('fails closed when Firestore errors', async () => {
    mockEnv.CDN_CACHE.get.mockResolvedValue(null);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await getProjectVisibility('project-123', mockEnv as any);

    expect(result).toEqual({ visibility: 'private', memberIds: [] });
  });

  it('fetches from Firestore when cache is stale', async () => {
    const staleCache = {
      visibility: 'public',
      memberIds: [],
      cachedAt: Date.now() - 120000,
    };

    mockEnv.CDN_CACHE.get.mockResolvedValue(staleCache);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          fields: {
            visibility: { stringValue: 'private' },
            memberIds: { arrayValue: { values: [{ stringValue: 'user-456' }] } },
          },
        }),
    });

    const result = await getProjectVisibility('project-123', mockEnv as any);

    expect(result).toEqual({
      visibility: 'private',
      memberIds: ['user-456'],
    });
    expect(mockEnv.CDN_CACHE.put).toHaveBeenCalled();
  });

  it('returns null when project not found in Firestore', async () => {
    mockEnv.CDN_CACHE.get.mockResolvedValue(null);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await getProjectVisibility('nonexistent', mockEnv as any);

    expect(result).toBeNull();
  });

  it('defaults to public when visibility field is missing', async () => {
    mockEnv.CDN_CACHE.get.mockResolvedValue(null);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          fields: {
            memberIds: { arrayValue: { values: [] } },
          },
        }),
    });

    const result = await getProjectVisibility('project-123', mockEnv as any);

    expect(result?.visibility).toBe('public');
  });

  describe('with service account authentication', () => {
    beforeEach(() => {
      (isServiceAccountConfigured as any).mockReturnValue(true);
      (getFirestoreAccessToken as any).mockResolvedValue('test-access-token');
    });

    it('includes Authorization header when service account is configured', async () => {
      mockEnv.CDN_CACHE.get.mockResolvedValue(null);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            fields: {
              visibility: { stringValue: 'private' },
              memberIds: { arrayValue: { values: [{ stringValue: 'user-123' }] } },
            },
          }),
      });

      await getProjectVisibility('project-123', mockEnv as any);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('firestore.googleapis.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        })
      );
    });

    it('fails closed when access token cannot be obtained', async () => {
      mockEnv.CDN_CACHE.get.mockResolvedValue(null);
      (getFirestoreAccessToken as any).mockResolvedValue(null);

      const result = await getProjectVisibility('project-123', mockEnv as any);

      // Should fail closed (return private) when auth fails
      expect(result).toEqual({ visibility: 'private', memberIds: [] });
    });

    it('fetches successfully with valid access token', async () => {
      mockEnv.CDN_CACHE.get.mockResolvedValue(null);

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

      const result = await getProjectVisibility('project-123', mockEnv as any);

      expect(result).toEqual({
        visibility: 'public',
        memberIds: [],
      });
    });
  });

  describe('without service account (unauthenticated mode)', () => {
    beforeEach(() => {
      (isServiceAccountConfigured as any).mockReturnValue(false);
    });

    it('makes unauthenticated request when service account not configured', async () => {
      mockEnv.CDN_CACHE.get.mockResolvedValue(null);

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

      await getProjectVisibility('project-123', mockEnv as any);

      // Should be called with empty headers object
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('firestore.googleapis.com'),
        expect.objectContaining({
          headers: {},
        })
      );
    });
  });
});
