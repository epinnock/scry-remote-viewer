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
 * Convert compound UUID to storage path
 * 
 * Input: "design-system-v1-0-0"
 * Output: { project: "design-system", version: "v1.0.0" }
 * 
 * Input: "my-app-v2-1-5"
 * Output: { project: "my-app", version: "v2.1.5" }
 */
export function parseCompoundUUID(uuid: string): { project: string; version: string } | null {
  const parts = uuid.split('-');
  
  // Find where version starts (first part starting with 'v' followed by digit)
  const versionStartIndex = parts.findIndex(part => /^v\d+$/.test(part));
  
  if (versionStartIndex === -1 || versionStartIndex === 0) {
    // No version pattern found - treat entire UUID as project with no version
    // Maps to {uuid}/storybook.zip
    return { project: uuid, version: '' };
  }
  
  // Everything before version = project
  const project = parts.slice(0, versionStartIndex).join('-');
  
  // Everything from version onward, convert dashes to dots
  // v1-0-0 → v1.0.0
  const versionParts = parts.slice(versionStartIndex);
  const version = versionParts.join('.').replace(/-/g, '.');
  
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