/**
 * ZIP-specific utility functions for path handling and caching
 */

/**
 * Normalize file path and handle directory requests
 */
export function normalizePath(pathname: string): string {
  const hasLeadingSlash = pathname.startsWith('/');
  let path = hasLeadingSlash ? pathname.slice(1) : pathname;

  if (!path) {
    path = 'index.html';
  }

  // Handle directory requests
  if (path.endsWith('/')) {
    path += 'index.html';
  }

  return path;
}

/**
 * Generate possible file paths for fallback logic
 */
export function getPossiblePaths(path: string): string[] {
  const paths = [path];

  // Try with /index.html if no extension
  if (!path.includes('.')) {
    paths.push(`${path}/index.html`);
    paths.push(`${path}.html`);
  }

  return paths;
}

/**
 * Get cache control header based on file type
 */
export function getCacheControl(path: string): string {
  // Versioned assets (containing hash in filename like app.a1b2c3d4.js)
  if (path.match(/\.[a-f0-9]{8,}\./)) {
    return 'public, max-age=31536000, immutable';
  }

  const ext = path.substring(path.lastIndexOf('.')).toLowerCase();

  // Images and fonts cache for 1 day
  if (
    ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(
      ext
    )
  ) {
    return 'public, max-age=86400';
  }

  // HTML should revalidate frequently
  if (['.html', '.htm'].includes(ext)) {
    return 'public, max-age=0, must-revalidate';
  }

  // Default: 1 hour cache
  return 'public, max-age=3600';
}

/**
 * Sanitize file path to prevent directory traversal attacks
 */
export function sanitizePath(path: string): string {
  return path
    .replace(/\.\./g, '') // Remove ..
    .replace(/^\/+/, '') // Remove leading slashes
    .replace(/\/+/g, '/'); // Normalize multiple slashes
}

/**
 * Check if path is safe to serve
 */
export function isPathSafe(path: string): boolean {
  const sanitized = sanitizePath(path);

  // Reject if sanitization changed the path (indicates attack attempt)
  if (sanitized !== path) {
    return false;
  }

  // Reject paths with null bytes
  if (path.includes('\0')) {
    return false;
  }

  return true;
}