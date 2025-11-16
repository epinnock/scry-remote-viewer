import { describe, it, expect } from 'vitest';
import { parsePathForUUID, isValidUUID } from '../../src/utils/subdomain';
import type { CompoundUUID } from '../../src/utils/path-resolver';

describe('subdomain path parsing with flexible versions', () => {
  describe('parsePathForUUID with PR versions', () => {
    it('detects pr-001 as version', () => {
      const result = parsePathForUUID('/my-project/pr-001/index.html');
      expect(result?.isValid).toBe(true);
      expect(result?.resolution?.type).toBe('compound');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('pr-001');
      expect(resolution.zipKey).toBe('my-project/pr-001/storybook.zip');
      expect(result?.filePath).toBe('index.html');
    });

    it('detects pr-123 as version', () => {
      const result = parsePathForUUID('/app/pr-123/components/button.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('pr-123');
      expect(result?.filePath).toBe('components/button.html');
    });

    it('handles PR version with no file path', () => {
      const result = parsePathForUUID('/project/pr-456/');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('pr-456');
      expect(result?.filePath).toBe('index.html');
    });
  });

  describe('parsePathForUUID with extended semantic versions', () => {
    it('detects v0.0.0.1 as version', () => {
      const result = parsePathForUUID('/app/v0.0.0.1/page.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('v0.0.0.1');
      expect(resolution.zipKey).toBe('app/v0.0.0.1/storybook.zip');
    });

    it('detects v1.2.3.4 as version', () => {
      const result = parsePathForUUID('/service/v1.2.3.4/index.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('v1.2.3.4');
    });

    it('detects v1.2.3.4.5 as version', () => {
      const result = parsePathForUUID('/lib/v1.2.3.4.5/docs.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('v1.2.3.4.5');
    });
  });

  describe('parsePathForUUID with named versions', () => {
    it('detects beta-2024 as version', () => {
      const result = parsePathForUUID('/lib/beta-2024/docs.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('beta-2024');
    });

    it('detects canary-latest as version', () => {
      const result = parsePathForUUID('/app/canary-latest/index.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('canary-latest');
    });

    it('detects dev-snapshot-123 as version', () => {
      const result = parsePathForUUID('/project/dev-snapshot-123/test.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('dev-snapshot-123');
    });

    it('detects alpha-v2 as version', () => {
      const result = parsePathForUUID('/component/alpha-v2/story.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('alpha-v2');
    });

    it('detects rc-1 as version', () => {
      const result = parsePathForUUID('/lib/rc-1/release.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('rc-1');
    });
  });

  describe('parsePathForUUID with environment versions', () => {
    it('detects staging as version', () => {
      const result = parsePathForUUID('/app/staging/index.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('staging');
    });

    it('detects latest as version', () => {
      const result = parsePathForUUID('/service/latest/docs.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('latest');
    });

    it('detects main as version', () => {
      const result = parsePathForUUID('/project/main/test.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('main');
    });

    it('detects production as version', () => {
      const result = parsePathForUUID('/app/production/app.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('production');
    });
  });

  describe('parsePathForUUID backward compatibility', () => {
    it('still works with traditional semantic versions', () => {
      const result = parsePathForUUID('/app/v1.0.0/index.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('v1.0.0');
      expect(resolution.zipKey).toBe('app/v1.0.0/storybook.zip');
    });

    it('still works with v2.1.5', () => {
      const result = parsePathForUUID('/lib/v2.1.5/components.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('v2.1.5');
    });

    it('handles paths without versions', () => {
      const result = parsePathForUUID('/simple-project/index.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('');
      expect(resolution.zipKey).toBe('simple-project/storybook.zip');
    });

    it('handles project with no file path', () => {
      const result = parsePathForUUID('/my-app/');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('');
      expect(result?.filePath).toBe('index.html');
    });
  });

  describe('parsePathForUUID edge cases', () => {
    it('handles deep file paths with PR versions', () => {
      const result = parsePathForUUID('/app/pr-123/components/buttons/primary.html');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('pr-123');
      expect(result?.filePath).toBe('components/buttons/primary.html');
    });

    it('handles paths with query parameters', () => {
      const result = parsePathForUUID('/project/v1.0.0/index.html?param=value');
      const resolution = result?.resolution as CompoundUUID;
      expect(resolution.version).toBe('v1.0.0');
      expect(result?.filePath).toBe('index.html?param=value');
    });

    it('rejects invalid project names', () => {
      const result = parsePathForUUID('/ab/index.html');
      expect(result?.isValid).toBe(false);
    });

    it('handles empty path', () => {
      const result = parsePathForUUID('/');
      expect(result).toBeNull();
    });
  });
});