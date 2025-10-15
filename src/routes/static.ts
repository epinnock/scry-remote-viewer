import { Hono } from 'hono';
import { createStorageAdapter } from '@/adapters/storage/factory';
import { parseSubdomain } from '@/utils/subdomain';
import { getMimeType } from '@/utils/mime-types';
import type { Env } from '@/types/env';

export const staticRoutes = new Hono<{ Bindings: Env }>();

staticRoutes.get('/*', async (c) => {
  const url = new URL(c.req.url);
  const storage = createStorageAdapter(c.env);

  // Extract UUID from subdomain
  const subdomainInfo = parseSubdomain(url.hostname);
  
  if (!subdomainInfo || !subdomainInfo.isValid) {
    return c.text('Invalid subdomain format. Expected: view-{uuid}.domain.com', 400);
  }

  const { uuid } = subdomainInfo;

  // Construct storage key
  let requestPath = url.pathname;
  
  // Default to index.html for root and directory paths
  if (requestPath === '/' || requestPath.endsWith('/')) {
    requestPath = requestPath + 'index.html';
  }

  // Remove leading slash for storage key
  const cleanPath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
  const objectKey = `${uuid}/${cleanPath}`;

  try {
    // Fetch from storage
    const object = await storage.get(objectKey);
    
    if (!object) {
      // Try index.html for potential SPA routing
      if (!cleanPath.includes('.')) {
        const indexKey = `${uuid}/index.html`;
        const indexObject = await storage.get(indexKey);
        
        if (indexObject) {
          return serveObject(c, indexObject, 'text/html');
        }
      }
      
      return c.text('Not Found', 404);
    }

    // Determine content type
    const contentType = object.contentType || getMimeType(cleanPath);

    return serveObject(c, object, contentType);
  } catch (error) {
    console.error('Error serving file:', error);
    return c.text('Internal Server Error', 500);
  }
});

function serveObject(c: any, object: any, contentType: string) {
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': c.env.CACHE_CONTROL || 'public, max-age=31536000, immutable',
    'Access-Control-Allow-Origin': c.env.ALLOWED_ORIGINS || '*',
  };

  if (object.size) {
    headers['Content-Length'] = object.size.toString();
  }

  if (object.etag) {
    headers['ETag'] = object.etag;
  }

  // Handle different body types
  if (object.body instanceof ReadableStream) {
    return new Response(object.body, { headers });
  }

  return new Response(object.body, { headers });
}