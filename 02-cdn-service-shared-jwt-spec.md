# CDN Service Implementation Spec — Shared JWT (Private Projects)

## Overview

Implement Firebase session cookie validation and project visibility checks in the Cloudflare Worker.

**Estimated Effort**: 3-4 days

---

## Changes Required

### 1. Add Dependencies

#### 1.1 Install jose Library

```bash
cd scry-cdn-service
pnpm add jose
```

`jose` is a lightweight JWT library that works in Cloudflare Workers (no Node.js dependencies).

---

### 2. Firebase Session Cookie Validation

#### 2.1 Create Auth Module

**File**: `src/auth/firebase-session.ts`

```typescript
import * as jose from 'jose';

// Google's public keys endpoint for Firebase session cookies
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys';

// Cache for Google's public keys
interface KeyCache {
  keys: Record<string, string>;
  expiresAt: number;
}

let keyCache: KeyCache | null = null;

/**
 * Fetch and cache Google's public keys for JWT verification
 */
async function getGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  
  // Return cached keys if still valid
  if (keyCache && keyCache.expiresAt > now) {
    return keyCache.keys;
  }
  
  const response = await fetch(GOOGLE_CERTS_URL);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Google public keys: ${response.status}`);
  }
  
  const keys = await response.json() as Record<string, string>;
  
  // Parse Cache-Control header for TTL
  const cacheControl = response.headers.get('Cache-Control');
  let maxAge = 3600; // Default 1 hour
  
  if (cacheControl) {
    const match = cacheControl.match(/max-age=(\d+)/);
    if (match) {
      maxAge = parseInt(match[1], 10);
    }
  }
  
  keyCache = {
    keys,
    expiresAt: now + (maxAge * 1000),
  };
  
  return keys;
}

export interface SessionValidationResult {
  valid: boolean;
  uid?: string;
  email?: string;
  error?: string;
}

/**
 * Validate a Firebase session cookie
 * 
 * @param sessionCookie - The __session cookie value
 * @param firebaseProjectId - Your Firebase project ID
 * @returns Validation result with user info if valid
 */
export async function validateFirebaseSessionCookie(
  sessionCookie: string,
  firebaseProjectId: string
): Promise<SessionValidationResult> {
  try {
    // Decode JWT header to get key ID
    const header = jose.decodeProtectedHeader(sessionCookie);
    
    if (!header.kid) {
      return { valid: false, error: 'Missing key ID in JWT header' };
    }
    
    // Get Google's public keys
    const publicKeys = await getGooglePublicKeys();
    const publicKeyPem = publicKeys[header.kid];
    
    if (!publicKeyPem) {
      return { valid: false, error: 'Unknown key ID' };
    }
    
    // Import the public key
    const publicKey = await jose.importX509(publicKeyPem, 'RS256');
    
    // Verify the JWT
    const { payload } = await jose.jwtVerify(sessionCookie, publicKey, {
      issuer: `https://session.firebase.google.com/${firebaseProjectId}`,
      audience: firebaseProjectId,
    });
    
    // Extract user info
    const uid = payload.sub;
    const email = payload.email as string | undefined;
    
    if (!uid) {
      return { valid: false, error: 'Missing user ID in token' };
    }
    
    return {
      valid: true,
      uid,
      email,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AUTH] Session validation failed:', message);
    return { valid: false, error: message };
  }
}

/**
 * Parse cookies from Cookie header
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  
  const cookies: Record<string, string> = {};
  
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name] = rest.join('=');
    }
  });
  
  return cookies;
}
```

---

### 3. Project Visibility Check

#### 3.1 Create Visibility Service

**File**: `src/services/visibility.ts`

```typescript
import type { Env } from '@/types/env';

export type ProjectVisibility = 'public' | 'private';

interface VisibilityCache {
  visibility: ProjectVisibility;
  memberIds: string[];
  cachedAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Get project visibility from Firestore (via REST API)
 * Results are cached in KV for performance
 */
export async function getProjectVisibility(
  projectId: string,
  env: Env
): Promise<{ visibility: ProjectVisibility; memberIds: string[] } | null> {
  const cacheKey = `visibility:${projectId}`;
  
  // Check KV cache first
  if (env.CDN_CACHE) {
    const cached = await env.CDN_CACHE.get(cacheKey, 'json') as VisibilityCache | null;
    
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return {
        visibility: cached.visibility,
        memberIds: cached.memberIds,
      };
    }
  }
  
  // Fetch from Firestore REST API
  try {
    const result = await fetchProjectFromFirestore(projectId, env);
    
    if (!result) {
      return null;
    }
    
    // Cache the result
    if (env.CDN_CACHE) {
      const cacheValue: VisibilityCache = {
        visibility: result.visibility,
        memberIds: result.memberIds,
        cachedAt: Date.now(),
      };
      
      await env.CDN_CACHE.put(cacheKey, JSON.stringify(cacheValue), {
        expirationTtl: 300, // 5 minutes max in KV
      });
    }
    
    return result;
  } catch (error) {
    console.error('[VISIBILITY] Failed to fetch project:', error);
    return null;
  }
}

/**
 * Fetch project document from Firestore REST API
 */
async function fetchProjectFromFirestore(
  projectId: string,
  env: Env
): Promise<{ visibility: ProjectVisibility; memberIds: string[] } | null> {
  const firebaseProjectId = env.FIREBASE_PROJECT_ID;
  
  if (!firebaseProjectId) {
    console.error('[VISIBILITY] FIREBASE_PROJECT_ID not configured');
    return null;
  }
  
  // For public Firestore access (if rules allow)
  // Or use service account auth (see below)
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/projects/${projectId}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Firestore request failed: ${response.status}`);
  }
  
  const doc = await response.json() as FirestoreDocument;
  
  // Parse Firestore document format
  const visibility = doc.fields?.visibility?.stringValue as ProjectVisibility || 'public';
  const memberIds = doc.fields?.memberIds?.arrayValue?.values?.map(
    (v: { stringValue: string }) => v.stringValue
  ) || [];
  
  return { visibility, memberIds };
}

interface FirestoreDocument {
  fields?: {
    visibility?: { stringValue: string };
    memberIds?: { arrayValue: { values: Array<{ stringValue: string }> } };
  };
}

/**
 * Check if a user is a member of a project
 */
export function isProjectMember(memberIds: string[], uid: string): boolean {
  return memberIds.includes(uid);
}
```

---

### 4. Auth Middleware

#### 4.1 Create Auth Middleware

**File**: `src/middleware/auth.ts`

```typescript
import type { Context, Next } from 'hono';
import type { Env } from '@/types/env';
import { validateFirebaseSessionCookie, parseCookies } from '@/auth/firebase-session';
import { getProjectVisibility, isProjectMember } from '@/services/visibility';

const SESSION_COOKIE_NAME = '__session';

export interface AuthContext {
  uid?: string;
  email?: string;
  isAuthenticated: boolean;
}

/**
 * Middleware to handle authentication for private projects
 * 
 * Flow:
 * 1. Parse projectId from URL
 * 2. Check project visibility
 * 3. If public: allow
 * 4. If private: validate session cookie and check membership
 */
export async function privateProjectAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const url = new URL(c.req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Extract projectId from path (first segment)
  const projectId = pathParts[0];
  
  if (!projectId) {
    return c.text('Invalid path', 400);
  }
  
  // Get project visibility
  const project = await getProjectVisibility(projectId, c.env);
  
  if (!project) {
    // Project not found - let the existing 404 handling take over
    return next();
  }
  
  // Public projects: allow without auth
  if (project.visibility === 'public') {
    return next();
  }
  
  // Private project: require authentication
  const cookies = parseCookies(c.req.header('Cookie'));
  const sessionCookie = cookies[SESSION_COOKIE_NAME];
  
  if (!sessionCookie) {
    console.log('[AUTH] No session cookie for private project:', projectId);
    return c.text('Unauthorized', 401);
  }
  
  // Validate session cookie
  const firebaseProjectId = c.env.FIREBASE_PROJECT_ID;
  
  if (!firebaseProjectId) {
    console.error('[AUTH] FIREBASE_PROJECT_ID not configured');
    return c.text('Server configuration error', 500);
  }
  
  const validation = await validateFirebaseSessionCookie(sessionCookie, firebaseProjectId);
  
  if (!validation.valid || !validation.uid) {
    console.log('[AUTH] Invalid session cookie:', validation.error);
    return c.text('Unauthorized', 401);
  }
  
  // Check project membership
  if (!isProjectMember(project.memberIds, validation.uid)) {
    console.log('[AUTH] User not a member:', { uid: validation.uid, projectId });
    return c.text('Forbidden', 403);
  }
  
  // User is authenticated and authorized
  console.log('[AUTH] Access granted:', { uid: validation.uid, projectId });
  
  return next();
}
```

---

### 5. Integrate Middleware

#### 5.1 Update App Configuration

**File**: `src/app.ts`

```typescript
import { Hono } from 'hono';
import { privateProjectAuth } from '@/middleware/auth';
import { zipStaticRoutes } from '@/routes/zip-static';
import { healthRoutes } from '@/routes/health';
import type { Env } from '@/types/env';

const app = new Hono<{ Bindings: Env }>();

// Health check (no auth)
app.route('/health', healthRoutes);

// Apply auth middleware to all viewer routes
app.use('/*', privateProjectAuth);

// Static file serving
app.route('/', zipStaticRoutes);

export default app;
```

---

### 6. Environment Variables

#### 6.1 Update Env Types

**File**: `src/types/env.ts`

```typescript
export interface Env {
  // Existing
  STATIC_SITES: R2Bucket;
  UPLOAD_BUCKET: R2Bucket;
  CDN_CACHE: KVNamespace;
  NODE_ENV: string;
  ALLOWED_ORIGINS: string;
  
  // New for auth
  FIREBASE_PROJECT_ID: string;
}
```

#### 6.2 Update Wrangler Config

**File**: `cloudflare/wrangler.toml`

```toml
[vars]
NODE_ENV = "production"
ALLOWED_ORIGINS = "https://dashboard.scrymore.com"
FIREBASE_PROJECT_ID = "your-firebase-project-id"
```

---

### 7. Firestore Access

#### Option A: Public Firestore Rules (Simpler)

If your Firestore rules allow public read of project visibility:

```javascript
// firestore.rules
match /projects/{projectId} {
  // Allow public read of visibility and memberIds only
  allow read: if request.query.limit == 1 
              && request.resource.data.keys().hasOnly(['visibility', 'memberIds']);
}
```

#### Option B: Service Account Auth (More Secure)

For production, use service account authentication:

**File**: `src/services/firestore-auth.ts`

```typescript
import * as jose from 'jose';

interface ServiceAccountConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

let accessToken: string | null = null;
let tokenExpiry = 0;

export async function getFirestoreAccessToken(config: ServiceAccountConfig): Promise<string> {
  const now = Date.now();
  
  if (accessToken && tokenExpiry > now) {
    return accessToken;
  }
  
  // Create JWT for service account
  const jwt = await createServiceAccountJWT(config);
  
  // Exchange for access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }
  
  const data = await response.json() as { access_token: string; expires_in: number };
  
  accessToken = data.access_token;
  tokenExpiry = now + (data.expires_in - 60) * 1000;
  
  return accessToken;
}

async function createServiceAccountJWT(config: ServiceAccountConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: config.clientEmail,
    sub: config.clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore',
  };
  
  // Import private key
  const privateKey = await jose.importPKCS8(
    config.privateKey.replace(/\\n/g, '\n'),
    'RS256'
  );
  
  // Sign JWT
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(privateKey);
}
```

---

## Testing

### Test Files to Create

| File | Description |
|------|-------------|
| `tests/auth/firebase-session.test.ts` | Cookie parsing and JWT validation |
| `tests/services/visibility.test.ts` | Visibility service and caching |
| `tests/middleware/auth.test.ts` | Auth middleware unit tests |
| `tests/integration/private-projects.test.ts` | Full integration tests |

---

### 1. Unit Tests — Cookie Parsing

**File**: `tests/auth/firebase-session.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCookies, validateFirebaseSessionCookie } from '@/auth/firebase-session';

describe('parseCookies', () => {
  it('parses single cookie', () => {
    const result = parseCookies('__session=abc123');
    expect(result).toEqual({ __session: 'abc123' });
  });

  it('parses multiple cookies', () => {
    const result = parseCookies('__session=abc123; other=value');
    expect(result).toEqual({ __session: 'abc123', other: 'value' });
  });

  it('handles null', () => {
    const result = parseCookies(null);
    expect(result).toEqual({});
  });

  it('handles empty string', () => {
    const result = parseCookies('');
    expect(result).toEqual({});
  });

  it('handles cookies with = in value', () => {
    const result = parseCookies('token=abc=def=ghi');
    expect(result).toEqual({ token: 'abc=def=ghi' });
  });

  it('trims whitespace around cookie names and values', () => {
    const result = parseCookies('  __session = abc123 ; other = value  ');
    expect(result.__session).toBeDefined();
  });
});

describe('validateFirebaseSessionCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invalid for malformed JWT', async () => {
    const result = await validateFirebaseSessionCookie('not-a-jwt', 'test-project');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns invalid for JWT without kid header', async () => {
    // Create a JWT without kid in header
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sub: 'user-123' }));
    const fakeJwt = `${header}.${payload}.signature`;

    const result = await validateFirebaseSessionCookie(fakeJwt, 'test-project');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('key ID');
  });

  // Note: Full JWT validation tests require mocking Google's public keys endpoint
  // See integration tests for end-to-end validation
});
```

---

### 2. Unit Tests — Visibility Service

**File**: `tests/services/visibility.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProjectVisibility, isProjectMember } from '@/services/visibility';

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached visibility when cache is fresh', async () => {
    const cachedData = {
      visibility: 'private',
      memberIds: ['user-123'],
      cachedAt: Date.now(), // Fresh cache
    };

    mockEnv.CDN_CACHE.get.mockResolvedValue(JSON.stringify(cachedData));

    const result = await getProjectVisibility('project-123', mockEnv as any);

    expect(result).toEqual({
      visibility: 'private',
      memberIds: ['user-123'],
    });
    expect(mockEnv.CDN_CACHE.get).toHaveBeenCalledWith('visibility:project-123', 'json');
  });

  it('fetches from Firestore when cache is stale', async () => {
    const staleCache = {
      visibility: 'public',
      memberIds: [],
      cachedAt: Date.now() - 120000, // 2 minutes ago (stale)
    };

    mockEnv.CDN_CACHE.get.mockResolvedValue(JSON.stringify(staleCache));

    // Mock fetch for Firestore
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
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
      json: () => Promise.resolve({
        fields: {
          // No visibility field
          memberIds: { arrayValue: { values: [] } },
        },
      }),
    });

    const result = await getProjectVisibility('project-123', mockEnv as any);

    expect(result?.visibility).toBe('public');
  });
});
```

---

### 3. Unit Tests — Auth Middleware

**File**: `tests/middleware/auth.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { privateProjectAuth } from '@/middleware/auth';

// Mock dependencies
vi.mock('@/services/visibility', () => ({
  getProjectVisibility: vi.fn(),
  isProjectMember: vi.fn(),
}));

vi.mock('@/auth/firebase-session', () => ({
  validateFirebaseSessionCookie: vi.fn(),
  parseCookies: vi.fn(),
}));

import { getProjectVisibility, isProjectMember } from '@/services/visibility';
import { validateFirebaseSessionCookie, parseCookies } from '@/auth/firebase-session';

describe('privateProjectAuth middleware', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();

    app = new Hono();
    app.use('/*', privateProjectAuth);
    app.get('/*', (c) => c.text('OK'));
  });

  const mockEnv = {
    FIREBASE_PROJECT_ID: 'test-project',
    CDN_CACHE: { get: vi.fn(), put: vi.fn() },
    UPLOAD_BUCKET: { get: vi.fn() },
  };

  it('allows access to public projects without auth', async () => {
    (getProjectVisibility as any).mockResolvedValue({
      visibility: 'public',
      memberIds: [],
    });

    const req = new Request('https://view.scrymore.com/public-project/v1/index.html');
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);
  });

  it('returns 401 for private project without session cookie', async () => {
    (getProjectVisibility as any).mockResolvedValue({
      visibility: 'private',
      memberIds: ['user-123'],
    });
    (parseCookies as any).mockReturnValue({});

    const req = new Request('https://view.scrymore.com/private-project/v1/index.html');
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid session cookie', async () => {
    (getProjectVisibility as any).mockResolvedValue({
      visibility: 'private',
      memberIds: ['user-123'],
    });
    (parseCookies as any).mockReturnValue({ __session: 'invalid-token' });
    (validateFirebaseSessionCookie as any).mockResolvedValue({
      valid: false,
      error: 'Invalid token',
    });

    const req = new Request('https://view.scrymore.com/private-project/v1/index.html', {
      headers: { Cookie: '__session=invalid-token' },
    });
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not a project member', async () => {
    (getProjectVisibility as any).mockResolvedValue({
      visibility: 'private',
      memberIds: ['other-user'],
    });
    (parseCookies as any).mockReturnValue({ __session: 'valid-token' });
    (validateFirebaseSessionCookie as any).mockResolvedValue({
      valid: true,
      uid: 'user-123',
    });
    (isProjectMember as any).mockReturnValue(false);

    const req = new Request('https://view.scrymore.com/private-project/v1/index.html', {
      headers: { Cookie: '__session=valid-token' },
    });
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(403);
  });

  it('allows access when user is a project member', async () => {
    (getProjectVisibility as any).mockResolvedValue({
      visibility: 'private',
      memberIds: ['user-123'],
    });
    (parseCookies as any).mockReturnValue({ __session: 'valid-token' });
    (validateFirebaseSessionCookie as any).mockResolvedValue({
      valid: true,
      uid: 'user-123',
    });
    (isProjectMember as any).mockReturnValue(true);

    const req = new Request('https://view.scrymore.com/private-project/v1/index.html', {
      headers: { Cookie: '__session=valid-token' },
    });
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);
  });

  it('passes through when project not found', async () => {
    (getProjectVisibility as any).mockResolvedValue(null);

    const req = new Request('https://view.scrymore.com/nonexistent/v1/index.html');
    const res = await app.fetch(req, mockEnv);

    // Should pass through to next handler (which may return 404)
    expect(res.status).toBe(200); // Our test handler returns 200
  });
});
```

---

### 4. Integration Tests

**File**: `tests/integration/private-projects.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '@/app';

describe('Private Projects Integration', () => {
  const createMockEnv = (overrides = {}) => ({
    NODE_ENV: 'production',
    FIREBASE_PROJECT_ID: 'test-project',
    UPLOAD_BUCKET: {
      get: vi.fn().mockResolvedValue({
        body: new ReadableStream(),
        httpMetadata: { contentType: 'text/html' },
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

      env.CDN_CACHE.get.mockResolvedValue(JSON.stringify({
        visibility: 'public',
        memberIds: [],
        cachedAt: Date.now(),
      }));

      const req = new Request('https://view.scrymore.com/public-project/v1/index.html');
      const res = await app.fetch(req, env);

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('does not require Cookie header', async () => {
      const app = createApp();
      const env = createMockEnv();

      env.CDN_CACHE.get.mockResolvedValue(JSON.stringify({
        visibility: 'public',
        memberIds: [],
        cachedAt: Date.now(),
      }));

      const req = new Request('https://view.scrymore.com/public-project/v1/index.html');
      const res = await app.fetch(req, env);

      expect(res.status).not.toBe(401);
    });
  });

  describe('Private Projects', () => {
    it('returns 401 without session cookie', async () => {
      const app = createApp();
      const env = createMockEnv();

      env.CDN_CACHE.get.mockResolvedValue(JSON.stringify({
        visibility: 'private',
        memberIds: ['user-123'],
        cachedAt: Date.now(),
      }));

      const req = new Request('https://view.scrymore.com/private-project/v1/index.html');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(401);
      expect(await res.text()).toBe('Unauthorized');
    });

    it('returns 401 with invalid session cookie', async () => {
      const app = createApp();
      const env = createMockEnv();

      env.CDN_CACHE.get.mockResolvedValue(JSON.stringify({
        visibility: 'private',
        memberIds: ['user-123'],
        cachedAt: Date.now(),
      }));

      const req = new Request('https://view.scrymore.com/private-project/v1/index.html', {
        headers: { Cookie: '__session=invalid-jwt' },
      });
      const res = await app.fetch(req, env);

      expect(res.status).toBe(401);
    });

    // Note: Testing with valid JWT requires mocking Google's public keys
    // or using a test Firebase project
  });

  describe('CORS with Private Projects', () => {
    it('handles OPTIONS preflight for private projects', async () => {
      const app = createApp();
      const env = createMockEnv();

      const req = new Request('https://view.scrymore.com/private-project/v1/coverage-report.json', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://dashboard.scrymore.com',
          'Access-Control-Request-Method': 'GET',
        },
      });

      const res = await app.fetch(req, env);

      // OPTIONS should be handled before auth middleware
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://dashboard.scrymore.com');
    });
  });

  describe('Caching', () => {
    it('caches visibility lookup in KV', async () => {
      const app = createApp();
      const env = createMockEnv();

      // First request - cache miss
      env.CDN_CACHE.get.mockResolvedValueOnce(null);

      // Mock Firestore response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          fields: {
            visibility: { stringValue: 'public' },
            memberIds: { arrayValue: { values: [] } },
          },
        }),
      });

      const req = new Request('https://view.scrymore.com/project/v1/index.html');
      await app.fetch(req, env);

      expect(env.CDN_CACHE.put).toHaveBeenCalledWith(
        'visibility:project',
        expect.any(String),
        expect.objectContaining({ expirationTtl: 300 })
      );
    });
  });
});
```

---

### 5. Manual Testing Checklist

#### Public Project Tests

- [ ] Access public project without login → content loads
- [ ] Access public project with login → content loads
- [ ] Verify no auth headers required

#### Private Project Tests

- [ ] Access private project without login → 401 Unauthorized
- [ ] Access private project with invalid cookie → 401 Unauthorized
- [ ] Access private project as non-member → 403 Forbidden
- [ ] Access private project as member → content loads

#### Cookie Tests

- [ ] Login on dashboard.scrymore.com
- [ ] Verify `__session` cookie sent to view.scrymore.com
- [ ] Logout → verify cookie cleared
- [ ] Access private project after logout → 401

#### Cache Tests

- [ ] Change project visibility → verify CDN reflects change within 60s
- [ ] Add member to project → verify access granted within 60s

---

### Running Tests

```bash
# Run all CDN service tests
cd scry-cdn-service
pnpm test

# Run specific test file
pnpm test tests/auth/firebase-session.test.ts

# Run with coverage
pnpm test --coverage

# Run in watch mode
pnpm test --watch

# Run integration tests only
pnpm test tests/integration/
```

---

### Test Coverage Goals

| Component | Target |
|-----------|--------|
| Cookie parsing | 100% |
| Visibility service | 90%+ |
| Auth middleware | 90%+ |
| Integration tests | Key flows covered |

---

## Rollout Checklist

- [ ] Install `jose` dependency
- [ ] Create `src/auth/firebase-session.ts`
- [ ] Create `src/services/visibility.ts`
- [ ] Create `src/middleware/auth.ts`
- [ ] Update `src/app.ts` to use auth middleware
- [ ] Update `src/types/env.ts` with new env vars
- [ ] Update `wrangler.toml` with `FIREBASE_PROJECT_ID`
- [ ] Add unit tests for cookie parsing
- [ ] Add unit tests for JWT validation (mocked)
- [ ] Add integration tests for auth flow
- [ ] Deploy to staging
- [ ] Test with real Firebase session cookie
- [ ] Deploy to production

---

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `jose` dependency |
| `src/auth/firebase-session.ts` | New - JWT validation |
| `src/services/visibility.ts` | New - Project visibility |
| `src/middleware/auth.ts` | New - Auth middleware |
| `src/app.ts` | Add auth middleware |
| `src/types/env.ts` | Add FIREBASE_PROJECT_ID |
| `cloudflare/wrangler.toml` | Add FIREBASE_PROJECT_ID |
| `tests/auth/firebase-session.test.ts` | New - Unit tests |
| `tests/integration/private-projects.test.ts` | New - Integration tests |

---

## Performance Considerations

1. **Google public keys**: Cached in memory with TTL from response headers
2. **Project visibility**: Cached in KV for 60 seconds
3. **JWT validation**: ~1-2ms per request (crypto operations)
4. **Firestore lookup**: Only on cache miss (~50-100ms)

Expected latency impact for private projects: **<5ms** (cached) to **~100ms** (cache miss).
