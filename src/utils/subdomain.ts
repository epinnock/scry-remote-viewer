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