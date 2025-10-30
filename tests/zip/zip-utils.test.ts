import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  getPossiblePaths,
  getCacheControl,
  sanitizePath,
  isPathSafe
} from '@/utils/zip-utils';

describe('ZIP Utilities', () => {
  describe('normalizePath', () => {
    it('should normalize root path to index.html', () => {
      expect(normalizePath('/')).toBe('index.html');
    });

    it('should add index.html to directory paths', () => {
      expect(normalizePath('/assets/')).toBe('assets/index.html');
    });

    it('should remove leading slash from file paths', () => {
      expect(normalizePath('/index.html')).toBe('index.html');
      expect(normalizePath('/assets/main.js')).toBe('assets/main.js');
    });

    it('should handle empty path', () => {
      expect(normalizePath('')).toBe('index.html');
    });

    it('should handle nested paths', () => {
      expect(normalizePath('/deep/nested/path/')).toBe('deep/nested/path/index.html');
    });
  });

  describe('getPossiblePaths', () => {
    it('should return original path for files with extensions', () => {
      const paths = getPossiblePaths('index.html');
      expect(paths).toContain('index.html');
    });

    it('should add fallback paths for paths without extensions', () => {
      const paths = getPossiblePaths('about');
      expect(paths).toContain('about');
      expect(paths).toContain('about/index.html');
      expect(paths).toContain('about.html');
    });

    it('should handle nested paths without extensions', () => {
      const paths = getPossiblePaths('docs/guide');
      expect(paths).toContain('docs/guide');
      expect(paths).toContain('docs/guide/index.html');
      expect(paths).toContain('docs/guide.html');
    });
  });

  describe('getCacheControl', () => {
    it('should return immutable cache for versioned assets', () => {
      const control = getCacheControl('app.a1b2c3d4.js');
      expect(control).toBe('public, max-age=31536000, immutable');
    });

    it('should return 1-day cache for images', () => {
      const control = getCacheControl('image.png');
      expect(control).toBe('public, max-age=86400');
    });

    it('should return 1-day cache for fonts', () => {
      const control = getCacheControl('font.woff2');
      expect(control).toBe('public, max-age=86400');
    });

    it('should return must-revalidate for HTML', () => {
      const control = getCacheControl('index.html');
      expect(control).toBe('public, max-age=0, must-revalidate');
    });

    it('should return 1-hour cache for other files', () => {
      const control = getCacheControl('data.json');
      expect(control).toBe('public, max-age=3600');
    });

    it('should handle various image formats', () => {
      expect(getCacheControl('image.jpg')).toBe('public, max-age=86400');
      expect(getCacheControl('image.gif')).toBe('public, max-age=86400');
      expect(getCacheControl('image.webp')).toBe('public, max-age=86400');
    });
  });

  describe('sanitizePath', () => {
    it('should remove directory traversal attempts', () => {
      expect(sanitizePath('../../../etc/passwd')).toBe('etc/passwd');
      expect(sanitizePath('..\\..\\windows\\system32')).toBe('\\\\windows\\system32');
    });

    it('should normalize multiple slashes', () => {
      expect(sanitizePath('assets///main.js')).toBe('assets/main.js');
    });

    it('should remove leading slashes', () => {
      expect(sanitizePath('///index.html')).toBe('index.html');
    });

    it('should handle safe paths unchanged', () => {
      expect(sanitizePath('assets/main.js')).toBe('assets/main.js');
      expect(sanitizePath('index.html')).toBe('index.html');
    });
  });

  describe('isPathSafe', () => {
    it('should accept safe paths', () => {
      expect(isPathSafe('index.html')).toBe(true);
      expect(isPathSafe('assets/main.js')).toBe(true);
      expect(isPathSafe('docs/guide/intro.md')).toBe(true);
    });

    it('should reject directory traversal attempts', () => {
      expect(isPathSafe('../../../etc/passwd')).toBe(false);
      expect(isPathSafe('..\\..\\windows\\system32')).toBe(false);
    });

    it('should reject paths with null bytes', () => {
      expect(isPathSafe('index.html\0.exe')).toBe(false);
    });

    it('should reject paths that change after sanitization', () => {
      expect(isPathSafe('///index.html')).toBe(false);
      expect(isPathSafe('assets///main.js')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isPathSafe('')).toBe(true);
      expect(isPathSafe('.')).toBe(true);
      expect(isPathSafe('..')).toBe(false);
    });
  });
});