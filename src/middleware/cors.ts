/**
 * CORS middleware utilities.
 *
 * The dashboard fetches public artifacts (e.g. coverage reports) from the CDN.
 * CORS is therefore a blocking dependency for dashboard integration.
 *
 * Design goals:
 * - Allow known dashboard origins explicitly (reflect Origin)
 * - Otherwise allow public access (wildcard '*')
 * - Provide correct preflight (OPTIONS) responses
 */

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://dashboard.scrymore.com',
  'https://www.scrymore.com',
  'http://localhost:3000',
  'http://localhost:3001'
] as const;

export interface CorsConfig {
  /**
   * Allowlist of origins that should be reflected back (sets Vary: Origin).
   * If the request origin is not in this list, we fall back to '*'.
   */
  allowedOrigins?: readonly string[];

  /**
   * If true, always respond with Access-Control-Allow-Origin: '*'.
   * Use when you explicitly want wildcard mode.
   */
  forceWildcard?: boolean;

  /** Optional override for Access-Control-Allow-Headers */
  allowHeaders?: string;

  /** Optional override for Access-Control-Allow-Methods */
  allowMethods?: string;

  /** Optional override for Access-Control-Max-Age */
  maxAgeSeconds?: number;
}

export function parseAllowedOrigins(value?: string): string[] | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Common legacy config: "*" means wildcard.
  if (trimmed === '*') return [];

  // Comma-separated list.
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsHeaders(request: Request, config: CorsConfig = {}): Headers {
  const origin = request.headers.get('Origin');

  const headers = new Headers();

  const allowMethods = config.allowMethods ?? 'GET, HEAD, OPTIONS';
  const allowHeaders = config.allowHeaders ?? 'Content-Type, Accept';
  const maxAgeSeconds = config.maxAgeSeconds ?? 86400;

  const allowedOrigins = config.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;

  if (config.forceWildcard) {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    // Reflect whitelisted origins.
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  } else {
    // Public, non-credentialed access.
    headers.set('Access-Control-Allow-Origin', '*');
  }

  headers.set('Access-Control-Allow-Methods', allowMethods);
  headers.set('Access-Control-Allow-Headers', allowHeaders);
  headers.set('Access-Control-Max-Age', String(maxAgeSeconds));

  return headers;
}

export function handleOptions(request: Request, config: CorsConfig = {}): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, config)
  });
}
