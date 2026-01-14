# scry-cdn-service Implementation Spec

## Overview

Update the CDN service to serve coverage report JSON files alongside Storybook builds.

The CDN service is responsible for:
- Serving static files from R2 storage
- Handling CORS for cross-origin requests
- Caching and content delivery

---

## 1. CORS Configuration (CRITICAL - Do First)

CORS must be configured before the dashboard can fetch coverage reports. This is a **blocking dependency** for the dashboard integration.

### Step-by-Step CORS Implementation

#### Step 1: Identify Current CORS Configuration

Check the current worker/service for existing CORS handling:
- Look for `Access-Control-Allow-Origin` headers
- Check for OPTIONS preflight handling

#### Step 2: Add CORS Middleware

Create or update CORS middleware:

```typescript
// src/middleware/cors.ts

const ALLOWED_ORIGINS = [
  'https://dashboard.scrymore.com',
  'https://www.scrymore.com',
  'http://localhost:3000',  // Development
  'http://localhost:3001',
];

export function corsHeaders(request: Request): Headers {
  const origin = request.headers.get('Origin');
  const headers = new Headers();
  
  // For coverage reports, allow any origin (public data)
  // Or restrict to known origins for security
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else {
    // Allow all origins for public coverage data
    headers.set('Access-Control-Allow-Origin', '*');
  }
  
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
  headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  
  return headers;
}

export function handleOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}
```

#### Step 3: Apply CORS to Worker

Update the main worker to use CORS:

```typescript
// cloudflare/worker.ts

import { corsHeaders, handleOptions } from '../src/middleware/cors';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    
    // ... existing routing logic ...
    
    // Add CORS headers to response
    const response = await handleRequest(request, env);
    const corsResponse = new Response(response.body, response);
    
    const cors = corsHeaders(request);
    cors.forEach((value, key) => {
      corsResponse.headers.set(key, value);
    });
    
    return corsResponse;
  },
};
```

#### Step 4: Test CORS Configuration

Before deploying dashboard changes, verify CORS works:

```bash
# Test preflight request
curl -X OPTIONS \
  -H "Origin: https://dashboard.scrymore.com" \
  -H "Access-Control-Request-Method: GET" \
  -v https://view.scrymore.com/test-project/v1.0.0/coverage-report.json

# Expected response headers:
# Access-Control-Allow-Origin: https://dashboard.scrymore.com
# Access-Control-Allow-Methods: GET, HEAD, OPTIONS

# Test actual request
curl -X GET \
  -H "Origin: https://dashboard.scrymore.com" \
  -v https://view.scrymore.com/test-project/v1.0.0/coverage-report.json
```

#### Step 5: Deploy and Verify

1. Deploy CDN service with CORS changes
2. Test from browser console:
   ```javascript
   fetch('https://view.scrymore.com/test-project/v1.0.0/coverage-report.json')
     .then(r => r.json())
     .then(console.log)
     .catch(console.error);
   ```
3. Verify no CORS errors in browser console

---

## 2. Coverage Report Serving

The coverage report JSON files will be stored in R2 at:
```
{projectId}/{versionId}/coverage-report.json
```

The CDN service needs to serve these files with appropriate headers.

### File: `cloudflare/worker.ts` or `src/routes/static.ts`

Add handling for coverage report requests:

```typescript
// Check if request is for coverage report
function isCoverageReportRequest(pathname: string): boolean {
  return pathname.endsWith('/coverage-report.json');
}

// Handle coverage report request
async function handleCoverageReport(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response> {
  // Remove leading slash to get R2 key
  const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  
  const object = await env.R2_BUCKET.get(key);
  
  if (!object) {
    return new Response(JSON.stringify({ error: 'Coverage report not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
  
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'public, max-age=3600'); // 1 hour cache
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  return new Response(object.body, { headers });
}
```

---

## 3. URL Structure

Coverage reports will be accessible at:

```
https://view.scrymore.com/{projectId}/{versionId}/coverage-report.json
```

Or via the storage URL:

```
https://storage.scrymore.com/{projectId}/{versionId}/coverage-report.json
```

The dashboard will fetch from whichever URL is stored in the build's `coverage.reportUrl` field.

---

## 4. Caching Strategy

Coverage reports are immutable once created, so aggressive caching is appropriate:

```typescript
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable', // 1 year
  'CDN-Cache-Control': 'max-age=31536000',
};
```

However, for development/testing, a shorter cache may be preferred:

```typescript
const CACHE_HEADERS_DEV = {
  'Cache-Control': 'public, max-age=60', // 1 minute
};
```

---

## 5. File Summary

| File | Action | Description |
|------|--------|-------------|
| `cloudflare/worker.ts` | Modify | Add coverage report handling |
| `src/middleware/cors.ts` | Modify | Ensure CORS for dashboard |

---

## 6. Minimal Changes Required

Since the CDN service already serves files from R2, the main changes are:

1. **CORS headers** - Ensure coverage JSON can be fetched from dashboard
2. **Content-Type** - Ensure JSON files are served with correct content type
3. **Caching** - Appropriate cache headers for JSON files

Most of this may already work if the CDN service properly serves all R2 files. The key requirement is that:

```
GET https://view.scrymore.com/{projectId}/{versionId}/coverage-report.json
```

Returns the JSON file with:
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *` (or specific dashboard origin)

---

## 7. Testing

1. Upload a coverage report via upload service
2. Verify it's accessible via CDN URL
3. Verify CORS headers allow dashboard fetch
4. Verify JSON is properly parsed by dashboard
