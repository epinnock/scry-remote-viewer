import { Hono } from 'hono';
import { parsePathForUUID } from '@/utils/subdomain';
import { getMimeType } from '@/utils/mime-types';
import { getCentralDirectory } from '@/services/zip/central-directory';
import { extractFile } from '@/services/zip/extractor';
import { normalizePath, isPathSafe, getCacheControl } from '@/utils/zip-utils';
import type { Env } from '@/types/env';

export const zipStaticRoutes = new Hono<{ Bindings: Env }>();

/**
 * Serve static files from ZIP archives stored in R2
 * Uses HTTP range requests for efficient partial extraction
 * Supports both legacy (simple UUID) and Upload Service (compound UUID) patterns
 */
zipStaticRoutes.get('/*', async (c) => {
  const url = new URL(c.req.url);
  const cache = c.env.CDN_CACHE! as any;

  // Extract UUID from path (view.domain.com/{uuid}/path)
  const pathInfo = parsePathForUUID(url.pathname);

  console.log('[DEBUG] URL pathname:', url.pathname);
  console.log('[DEBUG] Parsed pathInfo:', JSON.stringify(pathInfo, null, 2));

  if (!pathInfo || !pathInfo.isValid || !pathInfo.resolution) {
    console.error('[ERROR] Invalid path format:', { pathInfo, pathname: url.pathname });
    return c.text('Invalid format. Expected: view.domain.com/{uuid}/path', 400);
  }

  const { uuid, filePath, resolution } = pathInfo;
  console.log('[DEBUG] UUID:', uuid);
  console.log('[DEBUG] File path:', filePath);
  console.log('[DEBUG] Resolution:', JSON.stringify(resolution, null, 2));

  // NEW: Select bucket based on resolution type
  const storage = resolution.bucket === 'UPLOAD_BUCKET'
    ? c.env.UPLOAD_BUCKET! as any
    : c.env.STATIC_SITES! as any;

  // NEW: Use resolved ZIP key from path resolver
  const zipKey = resolution.zipKey;
  
  console.log('[DEBUG] Selected bucket:', resolution.bucket);
  console.log('[DEBUG] ZIP key:', zipKey);
  console.log('[DEBUG] Storage bucket available:', storage ? 'YES' : 'NO');

  // Normalize and validate requested path
  const cleanPath = normalizePath('/' + filePath);

  if (!isPathSafe(cleanPath)) {
    return c.text('Invalid path', 400);
  }

  try {
    // Get central directory (cached in KV)
    console.log('[DEBUG] Fetching central directory for:', zipKey);
    const centralDir = await getCentralDirectory(storage, cache, zipKey);
    console.log('[DEBUG] Central directory entries count:', Object.keys(centralDir.entries).length);
    console.log('[DEBUG] Available files:', Object.keys(centralDir.entries).slice(0, 10).join(', '));

    // Find the requested file
    let fileEntry = centralDir.entries[cleanPath];
    console.log('[DEBUG] Looking for file:', cleanPath);
    console.log('[DEBUG] File found:', fileEntry ? 'YES' : 'NO');

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
    console.error('[ERROR] Error serving file from ZIP:', error);
    console.error('[ERROR] Details:', {
      bucket: resolution.bucket,
      zipKey: zipKey,
      uuid: uuid,
      filePath: filePath,
      cleanPath: cleanPath,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined
    });
    return c.text('Internal Server Error', 500);
  }
});