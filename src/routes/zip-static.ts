import { Hono } from 'hono';
import { parseSubdomain } from '@/utils/subdomain';
import { getMimeType } from '@/utils/mime-types';
import { getCentralDirectory } from '@/services/zip/central-directory';
import { extractFile } from '@/services/zip/extractor';
import { normalizePath, isPathSafe, getCacheControl } from '@/utils/zip-utils';
import type { Env } from '@/types/env';

export const zipStaticRoutes = new Hono<{ Bindings: Env }>();

/**
 * Serve static files from ZIP archives stored in R2
 * Uses HTTP range requests for efficient partial extraction
 */
zipStaticRoutes.get('/*', async (c) => {
  const url = new URL(c.req.url);
  const storage = c.env.STATIC_SITES! as any;
  const cache = c.env.CDN_CACHE! as any;

  // Extract UUID from subdomain
  const subdomainInfo = parseSubdomain(url.hostname);

  if (!subdomainInfo || !subdomainInfo.isValid) {
    return c.text('Invalid subdomain format. Expected: view-{uuid}.domain.com', 400);
  }

  const { uuid } = subdomainInfo;

  // Normalize and validate requested path
  const cleanPath = normalizePath(url.pathname);

  if (!isPathSafe(cleanPath)) {
    return c.text('Invalid path', 400);
  }

  const zipKey = `${uuid}.zip`;

  try {
    // Get central directory (cached in KV)
    const centralDir = await getCentralDirectory(storage, cache, zipKey);

    // Find the requested file
    let fileEntry = centralDir.entries[cleanPath];

    if (!fileEntry) {
      // Try index.html for potential SPA routing
      if (!cleanPath.includes('.')) {
        const indexEntry = centralDir.entries['index.html'];

        if (indexEntry) {
          const data = await extractFile(storage, zipKey, indexEntry);
          return new Response(data, {
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': getCacheControl('index.html'),
              'Access-Control-Allow-Origin': c.env.ALLOWED_ORIGINS || '*'
            }
          });
        }
      }

      return c.text('Not Found', 404);
    }

    // Extract file using range request
    const fileData = await extractFile(storage, zipKey, fileEntry);

    // Determine content type
    const contentType = getMimeType(cleanPath);

    // Build response headers
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': getCacheControl(cleanPath),
      'Access-Control-Allow-Origin': c.env.ALLOWED_ORIGINS || '*',
      'Content-Length': fileEntry.size.toString(),
      'ETag': `"${fileEntry.crc32}"`
    };

    return new Response(fileData, { headers });
  } catch (error) {
    console.error('Error serving file from ZIP:', error);
    return c.text('Internal Server Error', 500);
  }
});