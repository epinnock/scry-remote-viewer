/**
 * Path resolution utilities for handling both simple and compound UUIDs
 * 
 * Simple UUID: storybook, my-app, abc-123
 * Compound UUID: design-system-v1-0-0, my-app-v2-1-5
 */

export interface SimpleUUID {
  type: 'simple';
  uuid: string;
  zipKey: string;
  bucket: 'STATIC_SITES';
}

export interface CompoundUUID {
  type: 'compound';
  uuid: string;
  project: string;
  version: string;
  zipKey: string;
  bucket: 'UPLOAD_BUCKET';
}

export type UUIDResolution = SimpleUUID | CompoundUUID;

/**
 * Detect if a UUID follows the compound pattern: {project}-{version}
 * 
 * Compound UUIDs have a version part starting with 'v' followed by digits
 * 
 * Examples:
 *   - "design-system-v1-0-0" → compound
 *   - "my-app-v2-1-5" → compound  
 *   - "storybook" → simple
 *   - "abc-123" → simple (no version pattern)
 */
export function detectUUIDType(uuid: string): 'simple' | 'compound' {
  // ALWAYS treat as compound - all UUIDs use UPLOAD_BUCKET
  // Format: {uuid} maps to {uuid}/storybook.zip in UPLOAD_BUCKET
  return 'compound';
}

/**
 * Detect if a UUID part represents the start of a version identifier
 * 
 * This is used when parsing compound UUIDs like "my-project-pr-001"
 * to identify where the project name ends and version begins.
 * 
 * A part is a version start if:
 * 1. It's a semantic version prefix (v + digits, like v1, v2)
 * 2. It's a known version prefix (pr, dev, beta, alpha, canary, rc) 
 *    followed by a hyphen and more content
 * 3. It's an environment name (staging, latest, main, production) that can stand alone
 */
function isVersionStart(parts: string[], index: number): boolean {
  const part = parts[index];
  if (!part) return false;
  
  // Check for semantic version prefix (v + digits)
  if (/^v\d+$/i.test(part)) {
    return true;
  }
  
  // Check for version prefixes that MUST be followed by more content
  const requiresFollowing = /^(pr|dev|beta|alpha|canary|rc)$/i;
  if (requiresFollowing.test(part) && index < parts.length - 1) {
    // Must have at least one more part after the prefix
    return true;
  }
  
  // Check for standalone environment/version names (can be at the end)
  const standaloneVersions = /^(staging|latest|main|production)$/i;
  if (standaloneVersions.test(part)) {
    return true;
  }
  
  return false;
}

/**
 * Convert compound UUID to storage path
 * 
 * Input: "design-system-v1-0-0"
 * Output: { project: "design-system", version: "v1.0.0" }
 * 
 * Input: "my-app-v2-1-5"
 * Output: { project: "my-app", version: "v2.1.5" }
 * 
 * Input: "my-project-pr-001"
 * Output: { project: "my-project", version: "pr-001" }
 */
export function parseCompoundUUID(uuid: string): { project: string; version: string } | null {
  const parts = uuid.split('-');
  
  // Find where version starts (first part that looks like a version prefix)
  const versionStartIndex = parts.findIndex((part, index) => isVersionStart(parts, index));
  
  if (versionStartIndex === -1 || versionStartIndex === 0) {
    // No version pattern found - treat entire UUID as project with no version
    // Maps to {uuid}/storybook.zip
    return { project: uuid, version: '' };
  }
  
  // Everything before version = project
  const project = parts.slice(0, versionStartIndex).join('-');
  
  // Everything from version onward
  const versionParts = parts.slice(versionStartIndex);
  const firstPart = versionParts[0];
  
  let version: string;
  
  // If it starts with 'v' followed by a digit, convert dashes to dots (semantic versioning)
  if (/^v\d+/i.test(firstPart)) {
    version = versionParts.join('.').replace(/-/g, '.');
  } else {
    // Keep original hyphen-based format for PR/dev/named versions (pr-001, dev-123)
    version = versionParts.join('-');
  }
  
  return { project, version };
}

/**
 * Resolve UUID to storage path and bucket
 * 
 * Returns bucket name and storage key for the ZIP file
 */
export function resolveUUID(uuid: string): UUIDResolution | null {
  // ALWAYS use compound/UPLOAD_BUCKET
  const type = detectUUIDType(uuid);
  
  // Compound UUID - parse to get project and version
  const parsed = parseCompoundUUID(uuid);
  if (!parsed) {
    return null; // Invalid compound format
  }
  
  // Upload Service storage pattern:
  // With version: {project}/{version}/storybook.zip
  // Without version: {project}/storybook.zip
  const zipKey = parsed.version
    ? `${parsed.project}/${parsed.version}/storybook.zip`
    : `${parsed.project}/storybook.zip`;
  
  return {
    type: 'compound',
    uuid,
    project: parsed.project,
    version: parsed.version,
    zipKey,
    bucket: 'UPLOAD_BUCKET'
  };
}

/**
 * Convert version string to URL-safe format
 * 
 * "v1.0.0" → "v1-0-0"
 */
export function versionToSlug(version: string): string {
  return version.replace(/\./g, '-');
}

/**
 * Convert URL slug to version format
 * 
 * "v1-0-0" → "v1.0.0"
 */
export function slugToVersion(slug: string): string {
  // Only convert numeric segments after 'v'
  // Matches patterns like v1-0-0, v2-1-5, etc.
  return slug.replace(/^(v\d+)-(\d+)-(\d+)/, '$1.$2.$3');
}