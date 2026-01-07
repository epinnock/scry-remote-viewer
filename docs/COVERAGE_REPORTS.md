# Coverage Report Serving

This document describes how the CDN service serves coverage reports (JSON) alongside Storybook builds.

## Storage Layout

Coverage reports are stored as standalone objects in R2 (not inside `storybook.zip`):

```
{projectId}/{versionId}/coverage-report.json
```

Examples:

- `design-system/v1.0.0/coverage-report.json`
- `my-app/pr-123/coverage-report.json`

## Public URL

Coverage reports are accessible at:

```
https://view.scrymore.com/{projectId}/{versionId}/coverage-report.json
```

This matches the CDN's existing path parsing logic in [`parsePathForUUID()`](src/utils/subdomain.ts:82).

## Handler Logic

The coverage report request is detected in [`zipStaticRoutes`](src/routes/zip-static.ts:1) before ZIP extraction runs.

Key behaviors:

- **Detection:** `filePath` ends with `coverage-report.json` (querystring ignored)
- **Object key derivation:** replace `/storybook.zip` with `/coverage-report.json`
- **Response Content-Type:** `application/json`
- **Caching:** aggressive immutable caching in production, short caching otherwise

## Caching Strategy

Coverage reports are immutable once published, so production responses are cached for 1 year:

- `Cache-Control: public, max-age=31536000, immutable`
- `CDN-Cache-Control: max-age=31536000`

In non-production environments (`NODE_ENV != 'production'`) a short TTL is used:

- `Cache-Control: public, max-age=60`

## CORS

CORS is applied globally at the app level in [`createApp()`](src/app.ts:1) using the helper functions in [`corsHeaders()`](src/middleware/cors.ts:1).

Policy:
- Requests from known dashboard origins are reflected (`Access-Control-Allow-Origin: <origin>`, with `Vary: Origin`)
- Other requests fall back to wildcard (`Access-Control-Allow-Origin: *`) to enable public fetching

### Preflight

OPTIONS requests receive a 204 response with:

- `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Accept`
- `Access-Control-Max-Age: 86400`

## Verification Commands

```bash
# Preflight
curl -X OPTIONS \
  -H "Origin: https://dashboard.scrymore.com" \
  -H "Access-Control-Request-Method: GET" \
  -v https://view.scrymore.com/test-project/v1.0.0/coverage-report.json

# Actual request
curl -H "Origin: https://dashboard.scrymore.com" \
  -v https://view.scrymore.com/test-project/v1.0.0/coverage-report.json
```

## Tests

Coverage report and CORS behavior is covered by:

- [`cors.test.ts`](tests/middleware/cors.test.ts:1)
- [`cors-preflight.test.ts`](tests/integration/cors-preflight.test.ts:1)
- [`coverage-report.test.ts`](tests/integration/coverage-report.test.ts:1)
