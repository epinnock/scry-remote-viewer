import { describe, it, expect } from 'vitest';
import {
  detectUUIDType,
  parseCompoundUUID,
  resolveUUID,
  versionToSlug,
  slugToVersion
} from '@/utils/path-resolver';

describe('path-resolver', () => {
  describe('detectUUIDType', () => {
    it('detects simple UUIDs', () => {
      expect(detectUUIDType('storybook')).toBe('simple');
      expect(detectUUIDType('my-app')).toBe('simple');
      expect(detectUUIDType('abc-123')).toBe('simple');
      expect(detectUUIDType('test-site')).toBe('simple');
    });

    it('detects compound UUIDs with version patterns', () => {
      expect(detectUUIDType('design-system-v1-0-0')).toBe('compound');
      expect(detectUUIDType('my-app-v2-1-5')).toBe('compound');
      expect(detectUUIDType('project-v1-0-0-beta')).toBe('compound');
      expect(detectUUIDType('component-library-v3-2-1')).toBe('compound');
    });

    it('treats UUIDs without version pattern as simple', () => {
      // No version part (v followed by digit)
      expect(detectUUIDType('my-app-beta')).toBe('simple');
      expect(detectUUIDType('test-one-two')).toBe('simple');
    });
  });

  describe('parseCompoundUUID', () => {
    it('parses valid compound UUIDs correctly', () => {
      expect(parseCompoundUUID('design-system-v1-0-0')).toEqual({
        project: 'design-system',
        version: 'v1.0.0'
      });

      expect(parseCompoundUUID('my-app-v2-1-5')).toEqual({
        project: 'my-app',
        version: 'v2.1.5'
      });

      expect(parseCompoundUUID('component-library-v3-2-1')).toEqual({
        project: 'component-library',
        version: 'v3.2.1'
      });
    });

    it('handles single-word project names', () => {
      expect(parseCompoundUUID('storybook-v1-0-0')).toEqual({
        project: 'storybook',
        version: 'v1.0.0'
      });
    });

    it('returns null for invalid formats', () => {
      expect(parseCompoundUUID('invalid')).toBeNull();
      expect(parseCompoundUUID('v1-0-0')).toBeNull(); // Starts with version
      expect(parseCompoundUUID('no-version-here')).toBeNull();
    });

    it('handles version with extra parts', () => {
      expect(parseCompoundUUID('project-v1-0-0-beta')).toEqual({
        project: 'project',
        version: 'v1.0.0.beta'
      });
    });
  });

  describe('resolveUUID', () => {
    it('resolves simple UUIDs to STATIC_SITES bucket', () => {
      const result = resolveUUID('storybook');
      expect(result).toEqual({
        type: 'simple',
        uuid: 'storybook',
        zipKey: 'storybook.zip',
        bucket: 'STATIC_SITES'
      });
    });

    it('resolves compound UUIDs to UPLOAD_BUCKET with correct path', () => {
      const result = resolveUUID('design-system-v1-0-0');
      expect(result).toEqual({
        type: 'compound',
        uuid: 'design-system-v1-0-0',
        project: 'design-system',
        version: 'v1.0.0',
        zipKey: 'design-system/v1.0.0/storybook.zip',
        bucket: 'UPLOAD_BUCKET'
      });
    });

    it('creates correct storage paths for compound UUIDs', () => {
      const result = resolveUUID('my-app-v2-1-5');
      expect(result?.zipKey).toBe('my-app/v2.1.5/storybook.zip');
      expect(result?.bucket).toBe('UPLOAD_BUCKET');
    });

    it('handles multi-word projects', () => {
      const result = resolveUUID('component-library-v3-0-0');
      expect(result?.project).toBe('component-library');
      expect(result?.zipKey).toBe('component-library/v3.0.0/storybook.zip');
    });

    it('returns null for invalid compound UUIDs', () => {
      const result = resolveUUID('v1-0-0'); // No project name
      expect(result).toBeNull();
    });
  });

  describe('version conversion utilities', () => {
    describe('versionToSlug', () => {
      it('converts dots to dashes', () => {
        expect(versionToSlug('v1.0.0')).toBe('v1-0-0');
        expect(versionToSlug('v2.1.5')).toBe('v2-1-5');
        expect(versionToSlug('v10.20.30')).toBe('v10-20-30');
      });

      it('handles versions without v prefix', () => {
        expect(versionToSlug('1.0.0')).toBe('1-0-0');
      });
    });

    describe('slugToVersion', () => {
      it('converts dashes to dots for version numbers', () => {
        expect(slugToVersion('v1-0-0')).toBe('v1.0.0');
        expect(slugToVersion('v2-1-5')).toBe('v2.1.5');
        expect(slugToVersion('v10-20-30')).toBe('v10.20.30');
      });

      it('only converts version pattern segments', () => {
        // Should only match v{digit}-{digit}-{digit} pattern
        expect(slugToVersion('v1-0-0')).toBe('v1.0.0');
        expect(slugToVersion('v1-0-0-beta')).toBe('v1.0.0-beta'); // Extra part stays
      });
    });
  });

  describe('integration scenarios', () => {
    it('handles real-world Storybook examples', () => {
      // Design system v1.0.0
      const ds1 = resolveUUID('design-system-v1-0-0');
      expect(ds1?.zipKey).toBe('design-system/v1.0.0/storybook.zip');
      expect(ds1?.bucket).toBe('UPLOAD_BUCKET');

      // My app v2.1.5
      const app = resolveUUID('my-app-v2-1-5');
      expect(app?.zipKey).toBe('my-app/v2.1.5/storybook.zip');
      expect(app?.bucket).toBe('UPLOAD_BUCKET');
    });

    it('maintains backward compatibility with legacy UUIDs', () => {
      const legacy = resolveUUID('storybook');
      expect(legacy?.zipKey).toBe('storybook.zip');
      expect(legacy?.bucket).toBe('STATIC_SITES');
    });

    it('correctly distinguishes between simple and compound patterns', () => {
      // Simple (no version pattern)
      expect(resolveUUID('my-app')?.type).toBe('simple');
      expect(resolveUUID('test-site')?.type).toBe('simple');
      
      // Compound (has version pattern)
      expect(resolveUUID('my-app-v1-0-0')?.type).toBe('compound');
      expect(resolveUUID('test-site-v2-0-0')?.type).toBe('compound');
    });
  });
});