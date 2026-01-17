# PR: Add Service Account Authentication for Firestore (Option B)

## Summary

Implements authenticated Firestore access using GCP service account credentials, enabling the CDN worker to read project visibility data without requiring public Firestore security rules.

**Spec Reference**: `02-cdn-service-shared-jwt-spec.md` Section 7 (Option B)

---

## Why This Change?

The existing Firestore rules require authentication:
```javascript
allow read: if isAuthenticated() && ...
```

Without service account auth, the CDN worker's unauthenticated REST API calls fail. This PR adds the ability to authenticate as a trusted service account.

---

## Changes Overview

### New Files

| File | Purpose |
|------|---------|
| `src/services/firestore-auth.ts` | JWT creation, OAuth2 token exchange, KV caching |
| `tests/services/firestore-auth.test.ts` | Unit tests for auth module |

### Modified Files

| File | Change |
|------|--------|
| `src/types/env.ts` | Added `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| `src/services/visibility.ts` | Conditionally uses authenticated requests |
| `tests/services/visibility.test.ts` | Added tests for authenticated mode |
| `cloudflare/wrangler.toml` | Documented new secrets |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CDN Worker                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │ visibility.ts    │───▶│ firestore-auth.ts                │  │
│  │                  │    │                                   │  │
│  │ getProjectVis()  │    │ 1. Check KV cache for token      │  │
│  │                  │    │ 2. If expired: create JWT        │  │
│  └────────┬─────────┘    │ 3. Exchange JWT for access token │  │
│           │              │ 4. Cache token in KV             │  │
│           │              └──────────────────────────────────┘  │
│           │                              │                      │
│           ▼                              ▼                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Firestore REST API                           │  │
│  │  Authorization: Bearer {access_token}                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Implementation Details

### 1. Automatic Mode Detection

```typescript
// src/services/visibility.ts
if (isServiceAccountConfigured(env)) {
  const accessToken = await getFirestoreAccessToken(env);
  headers['Authorization'] = `Bearer ${accessToken}`;
} else {
  // Falls back to unauthenticated (requires public Firestore rules)
}
```

### 2. Token Caching Strategy

- Access tokens cached in KV namespace (`firestore:access_token`)
- Tokens refreshed 60 seconds before expiry
- KV TTL set slightly less than token expiry
- Graceful fallback if cache read fails

### 3. Fail-Closed Security

If service account is configured but token generation fails:
```typescript
// Returns private visibility to prevent unauthorized access
return { visibility: 'private', memberIds: [] };
```

---

## Testing

### Test Coverage

| Component | Tests | Coverage |
|-----------|-------|----------|
| `isServiceAccountConfigured()` | 5 | 100% |
| `getFirestoreAccessToken()` | 5 | Key paths |
| Visibility with auth | 4 | Auth flow |

### Run Tests

```bash
pnpm test
# All 158 tests pass
```

### Key Test Cases

1. **Credentials not configured** → Returns null, falls back to unauthenticated
2. **Cached token valid** → Returns cached token without API call
3. **Invalid private key** → Returns null, logs error
4. **Auth header included** → Verifies `Authorization: Bearer` header sent

---

## Deployment Checklist

### Prerequisites

- [ ] GCP service account created with `roles/datastore.viewer`
- [ ] Service account JSON key downloaded

### Cloudflare Secrets

```bash
# Set service account email
wrangler secret put FIREBASE_CLIENT_EMAIL
# Paste: cdn-worker@your-project.iam.gserviceaccount.com

# Set private key (with escaped newlines)
wrangler secret put FIREBASE_PRIVATE_KEY
# Paste: -----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----
```

### Verification

1. Deploy to staging
2. Access a private project without login → Should return 401
3. Check worker logs for `[VISIBILITY] Using service account authentication`

---

## Rollback Plan

If issues occur:
1. Remove secrets: `wrangler secret delete FIREBASE_CLIENT_EMAIL`
2. Worker automatically falls back to unauthenticated mode
3. Ensure Firestore rules allow public read (temporary)

---

## Review Checklist

- [ ] `src/services/firestore-auth.ts` — JWT signing logic correct
- [ ] `src/services/visibility.ts` — Auth header properly included
- [ ] `src/types/env.ts` — New env vars typed correctly
- [ ] Tests cover happy path and error cases
- [ ] No secrets or credentials in code
- [ ] Logging uses `console.info`/`console.error` (not `console.log`)

---

## Related

- Spec: `02-cdn-service-shared-jwt-spec.md`
- Previous PR: Firebase session cookie validation (Option A)
