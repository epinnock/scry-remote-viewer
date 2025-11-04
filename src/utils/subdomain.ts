import { resolveUUID, type UUIDResolution } from './path-resolver';

export interface SubdomainInfo {
  uuid: string;
  isValid: boolean;
}

/**
 * Parse subdomain to extract UUID
 * Expected format: view-{uuid}.domain.com
 */
export function parseSubdomain(hostname: string): SubdomainInfo | null {
  const parts = hostname.split('.');
  if (parts.length < 2) {
    return null;
  }

  const subdomain = parts[0];
  const match = subdomain.match(/^view-(.+)$/);

  if (!match) {
    return null;
  }

  const uuid = match[1];

  // Basic UUID validation (can be more strict)
  if (!uuid || uuid.length < 3) {
    return { uuid, isValid: false };
  }

  return { uuid, isValid: true };
}

/**
 * Validate UUID format (simple version)
 * Can be enhanced with proper UUID v4 validation
 */
export function isValidUUID(uuid: string): boolean {
  // Allow alphanumeric and hyphens, minimum 3 chars
  return /^[a-zA-Z0-9-]{3,}$/.test(uuid);
}

/**
 * Parse path to extract projectId, versionId, and file path
 * Expected format: /{projectId}/{versionId}/path/to/file.html
 * Or: /{projectId}/path/to/file.html (no version)
 */
export interface PathInfo {
  uuid: string;  // Kept for compatibility, will be projectId-versionId
  filePath: string;
  isValid: boolean;
  resolution?: UUIDResolution;
}

export function parsePathForUUID(pathname: string): PathInfo | null {
  // Remove leading slash
  const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  
  // Split path into segments
  const segments = cleanPath.split('/').filter(s => s); // Remove empty segments
  
  // Need at least projectId
  if (segments.length === 0) {
    return null;
  }
  
  const projectId = segments[0];
  
  // Validate projectId format (alphanumeric + hyphens, min 3 chars)
  if (!isValidUUID(projectId)) {
    return { uuid: projectId, filePath: '', isValid: false };
  }
  
  let versionId = '';
  let filePathStartIndex = 1;
  
  // Check if second segment is a version (starts with 'v' followed by digits/dots)
  if (segments.length >= 2 && /^v[\d.]+$/.test(segments[1])) {
    versionId = segments[1];
    filePathStartIndex = 2;
  }
  
  // Remaining segments form the file path
  const filePath = segments.slice(filePathStartIndex).join('/');
  
  // Create resolution
  const zipKey = versionId
    ? `${projectId}/${versionId}/storybook.zip`
    : `${projectId}/storybook.zip`;
  
  const resolution: UUIDResolution = {
    type: 'compound',
    uuid: versionId ? `${projectId}-${versionId.replace(/\./g, '-')}` : projectId,
    project: projectId,
    version: versionId,
    zipKey,
    bucket: 'UPLOAD_BUCKET'
  };
  
  return {
    uuid: resolution.uuid,
    filePath: filePath || 'index.html', // Default to index.html if no file path
    isValid: true,
    resolution
  };
}