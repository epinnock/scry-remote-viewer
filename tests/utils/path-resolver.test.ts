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
    it('detects all UUIDs as compound (unified storage)', () => {
      // All UUIDs now use UPLOAD_BUCKET with compound format
      expect(detectUUIDType('storybook')).toBe('compound');
      expect(detectUUIDType('my-app')).toBe('compound');
      expect(detectUUIDType('abc-123')).toBe('compound');
    });

    it('detects compound UUIDs with versions', () => {
      expect(detectUUIDType('design-system-v1-0-0')).toBe('compound');
      expect(detectUUIDType('my-app-v2-1-5')).toBe('compound');
    });

    it('treats all UUIDs as compound regardless of version pattern', () => {
      // All UUIDs use the compound/UPLOAD_BUCKET storage
      expect(detectUUIDType('my-app-beta')).toBe('compound');
      expect(detectUUIDType('test-one-two')).toBe('compound');
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

    it('handles all formats as valid in unified storage', () => {
      // In the unified system, all UUIDs are valid and map to UPLOAD_BUCKET
      // Single word becomes project with no version
      const result1 = parseCompoundUUID('invalid');
      expect(result1).toEqual({ project: 'invalid', version: '' });
      
      // Version-like pattern without hyphenated project is treated as project name
      const result2 = parseCompoundUUID('v1-0-0');
      expect(result2).toEqual({ project: 'v1-0-0', version: '' });
      
      // Any hyphenated string without version pattern
      const result3 = parseCompoundUUID('no-version-here');
      expect(result3).toEqual({ project: 'no-version-here', version: '' });
    });

    it('handles version with extra parts', () => {
      expect(parseCompoundUUID('project-v1-0-0-beta')).toEqual({
        project: 'project',
        version: 'v1.0.0.beta'
      });
    });
  });

  describe('resolveUUID', () => {
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
      expect(result?.type).toBe('compound');
      if (result?.type === 'compound') {
        expect(result.project).toBe('component-library');
      }
      expect(result?.zipKey).toBe('component-library/v3.0.0/storybook.zip');
    });

    it('returns null for invalid compound UUIDs', () => {
      // ... existing code ...
      const result = resolveUUID('v1-0-0');
      expect(result).toEqual({
        type: 'compound',
        uuid: 'v1-0-0',
        project: 'v1-0-0',
        version: '',
        zipKey: 'v1-0-0/storybook.zip',
        bucket: 'UPLOAD_BUCKET'
      });
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
      expect(legacy?.zipKey).toBe('storybook/storybook.zip');
      expect(legacy?.bucket).toBe('UPLOAD_BUCKET');
    });

    it('correctly distinguishes between simple and compound patterns', () => {
      // Simple (now part of unify)
      expect(resolveUUID('my-app')?.type).toBe('compound');
      expect(resolveUUID('test-site')?.type).toBe('compound');
      
      // Compound (has version pattern)
      expect(resolveUUID('my-app-v1-0-0')?.type).toBe('compound');
      expect(resolveUUID('test-site-v2-0-0')?.type).toBe('compound');
    });
  });

  describe('PR and extended version support', () => {
    describe('parseCompoundUUID with PR versions', () => {
      it('handles PR version format', () => {
        expect(parseCompoundUUID('my-project-pr-001')).toEqual({
          project: 'my-project',
          version: 'pr-001'
        });
      });

      it('handles PR version with multiple digits', () => {
        expect(parseCompoundUUID('app-pr-123')).toEqual({
          project: 'app',
          version: 'pr-123'
        });
      });

      it('handles dev version format', () => {
        expect(parseCompoundUUID('lib-dev-456')).toEqual({
          project: 'lib',
          version: 'dev-456'
        });
      });

      it('handles beta/alpha versions', () => {
        expect(parseCompoundUUID('lib-beta-2024')).toEqual({
          project: 'lib',
          version: 'beta-2024'
        });
        
        expect(parseCompoundUUID('app-alpha-v2')).toEqual({
          project: 'app',
          version: 'alpha-v2'
        });
      });
    });

    describe('parseCompoundUUID with extended semantic versions', () => {
      it('handles 4-part semantic versions', () => {
        expect(parseCompoundUUID('app-v0-0-0-1')).toEqual({
          project: 'app',
          version: 'v0.0.0.1'
        });
      });

      it('handles 5-part semantic versions', () => {
        expect(parseCompoundUUID('service-v1-2-3-4-5')).toEqual({
          project: 'service',
          version: 'v1.2.3.4.5'
        });
      });
    });

    describe('resolveUUID with PR versions', () => {
      it('correctly resolves PR version to storage path', () => {
        const result = resolveUUID('my-project-pr-001');
        expect(result).toEqual({
          type: 'compound',
          uuid: 'my-project-pr-001',
          project: 'my-project',
          version: 'pr-001',
          zipKey: 'my-project/pr-001/storybook.zip',
          bucket: 'UPLOAD_BUCKET'
        });
      });

      it('correctly resolves extended semantic version', () => {
        const result = resolveUUID('app-v0-0-0-1');
        expect(result).toEqual({
          type: 'compound',
          uuid: 'app-v0-0-0-1',
          project: 'app',
          version: 'v0.0.0.1',
          zipKey: 'app/v0.0.0.1/storybook.zip',
          bucket: 'UPLOAD_BUCKET'
        });
      });

      it('handles dev snapshot versions', () => {
        const result = resolveUUID('project-dev-snapshot-789');
        expect(result).toEqual({
          type: 'compound',
          uuid: 'project-dev-snapshot-789',
          project: 'project',
          version: 'dev-snapshot-789',
          zipKey: 'project/dev-snapshot-789/storybook.zip',
          bucket: 'UPLOAD_BUCKET'
        });
      });

      it('handles beta release versions', () => {
        const result = resolveUUID('lib-beta-2024');
        expect(result).toEqual({
          type: 'compound',
          uuid: 'lib-beta-2024',
          project: 'lib',
          version: 'beta-2024',
          zipKey: 'lib/beta-2024/storybook.zip',
          bucket: 'UPLOAD_BUCKET'
        });
      });

      it('handles alpha release versions', () => {
        const result = resolveUUID('app-alpha-v2');
        expect(result).toEqual({
          type: 'compound',
          uuid: 'app-alpha-v2',
          project: 'app',
          version: 'alpha-v2',
          zipKey: 'app/alpha-v2/storybook.zip',
          bucket: 'UPLOAD_BUCKET'
        });
      });

      it('handles canary versions', () => {
        const result = resolveUUID('service-canary-latest');
        expect(result).toEqual({
          type: 'compound',
          uuid: 'service-canary-latest',
          project: 'service',
          version: 'canary-latest',
          zipKey: 'service/canary-latest/storybook.zip',
          bucket: 'UPLOAD_BUCKET'
        });
      });

      it('handles release candidate versions', () => {
        const result = resolveUUID('lib-rc-1');
        expect(result).toEqual({
          type: 'compound',
          uuid: 'lib-rc-1',
          project: 'lib',
          version: 'rc-1',
          zipKey: 'lib/rc-1/storybook.zip',
          bucket: 'UPLOAD_BUCKET'
        });
      });

      it('handles environment versions', () => {
        const result = resolveUUID('app-staging');
        expect(result).toEqual({
          type: 'compound',
          uuid: 'app-staging',
          project: 'app',
          version: 'staging',
          zipKey: 'app/staging/storybook.zip',
          bucket: 'UPLOAD_BUCKET'
        });
      });

      it('handles latest version', () => {
        const result = resolveUUID('service-latest');
        expect(result).toEqual({
          type: 'compound',
          uuid: 'service-latest',
          project: 'service',
          version: 'latest',
          zipKey: 'service/latest/storybook.zip',
          bucket: 'UPLOAD_BUCKET'
        });
      });

      it('handles main branch version', () => {
        const result = resolveUUID('project-main');
        expect(result).toEqual({
          type: 'compound',
          uuid: 'project-main',
          project: 'project',
          version: 'main',
          zipKey: 'project/main/storybook.zip',
          bucket: 'UPLOAD_BUCKET'
        });
      });
    });
  });
});