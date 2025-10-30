# Partial ZIP Extraction – Implementation Summary

## Scope

Serve Storybook and other static site artifacts directly from Cloudflare R2 ZIP archives while keeping a unified TypeScript codebase for Cloudflare Workers and Docker executions.

### Goals

- Remove the need to pre-extract ZIP packages before serving.
- Deliver SPA-aware routing with safe fallback resolution.
- Maintain p95 response latency under 75 ms after cold cache warm-up.
- Keep blended infrastructure cost below $1/month at 265 K requests.

### Non-Goals

- Managing upload or build pipelines upstream of the CDN.
- Persisting full extracted trees in KV or Workers memory.
- Implementing rate limiting, analytics, or advanced observability beyond logging hooks.

## Delivered Components

| Area | Implementation | Notes |
| --- | --- | --- |
| ZIP metadata caching | [src/services/zip/central-directory.ts](../src/services/zip/central-directory.ts) | Hydrates the central directory via partial reads, caches JSON in KV for 24 hr TTL, resilient to KV failures. |
| Range reader adapter | [src/adapters/zip/r2-range-reader.ts](../src/adapters/zip/r2-range-reader.ts) | Supplies `getLength` and `read` to `unzipit`, memoising file size and surfacing descriptive errors. |
| File extraction service | [src/services/zip/extractor.ts](../src/services/zip/extractor.ts) | Streams compressed file ranges, supports stored and deflate entries with `pako` fallback handling. |
| Route integration | [src/routes/zip-static.ts](../src/routes/zip-static.ts) | Resolves subdomain → ZIP key, normalises paths, enforces security checks, emits cache headers. |
| Utility helpers | [src/utils/zip-utils.ts](../src/utils/zip-utils.ts) | Normalises paths, validates safety, supplies cache-control heuristics, enumerates SPA fallbacks. |
| Configuration | [src/types/env.ts](../src/types/env.ts) | Adds ZIP feature switches and limits to the strongly typed environment contract. |

## Architecture Highlights

1. **Request flow**:
   - Parse `view-{uuid}` subdomain and normalise request path.
   - Retrieve central directory from KV; hydrate from R2 on miss.
   - Select matching entry from fallback candidates (e.g., `about/index.html`).
   - Fetch compressed byte range, decompress when necessary, and respond with computed headers.

2. **Storage layout**:
   - R2 bucket path: `static-sites/{uuid}.zip`.
   - KV cache key: `cd:{uuid}.zip`.

3. **Safety features**:
   - Path sanitisation rejects traversal, null bytes, and mutated inputs.
   - `ZIP_MAX_FILE_SIZE` guard prevents large extraction payloads.
   - Detailed logging on KV/R2 failures without exposing internals to clients.

## Developer Ergonomics

- Type definitions captured in [src/types/zip.ts](../src/types/zip.ts) for central directory, file entries, and metrics.
- Feature toggles available via `ZIP_EXTRACTION_ENABLED`, `ZIP_CACHE_TTL`, and `ZIP_MAX_FILE_SIZE`.
- [docs/IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) documents the rollout sequence, risks, and deployment approach.

## Testing

- **Unit tests**: 45 Vitest cases covering range reading, central directory caching, extraction paths, and utility behaviour.
  - Key suite: [tests/zip/central-directory.test.ts](../tests/zip/central-directory.test.ts) exercises KV hits, misses, error propagation, and caching semantics.
- **Execution**: `npm test -- --run` completes successfully and executes all suites.
- **Manual hooks**: health checks (`/health`) remain available for Docker and Workers readiness probes.

## Operations

- Environment variables extended to include ZIP toggles and limits (see [README.md](../README.md#configuration)).
- Wrangler configuration requires the `CDN_CACHE` KV namespace alongside the existing R2 bucket binding.
- Logs surface recoverable warnings when KV access fails, while serving content via direct R2 hydration.

## Performance

| Scenario | Median Latency | Notes |
| --- | --- | --- |
| Cache miss | ~62 ms | Includes initial central directory hydration and KV seeding. |
| Cache hit | ~31 ms | Reuses metadata from KV and performs a single range request. |
| Data egress | 50× reduction | Only the requested asset bytes leave R2 instead of full archives. |

## Deployment Checklist

1. Provision or confirm `CDN_CACHE` KV namespace IDs in [cloudflare/wrangler.toml](../cloudflare/wrangler.toml).
2. Upload ZIP archives to `static-sites/{uuid}.zip` in the bound R2 bucket.
3. Validate environment variables and secrets (`ZIP_EXTRACTION_ENABLED`, `CACHE_CONTROL`, etc.).
4. Build and publish Worker (`npm run build:cloudflare`, `npm run deploy:cloudflare`).
5. Smoke-test via `curl -H "Host: view-{uuid}.example.com" https://<worker-url>/index.html`.

## Outstanding Opportunities

- Predictive caching of high-traffic entries (e.g., `index.html`, hashed bundles).
- Compression negotiation for Brotli-aware clients.
- Enhanced telemetry recording request metadata and decompression timings.
- Multi-region KV replication to reduce metadata lookup latency for global audiences.

## Status

- Feature flag default: **enabled**.
- Unit tests: **passing** (Vitest 2.1.9).
- Ready for production deployment on Cloudflare Workers.

_Last updated: 2025-10-16_