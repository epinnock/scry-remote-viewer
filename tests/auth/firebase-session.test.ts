import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseCookies,
  validateFirebaseSessionCookie,
} from '@/auth/firebase-session';

describe('parseCookies', () => {
  it('parses single cookie', () => {
    const result = parseCookies('__session=abc123');
    expect(result).toEqual({ __session: 'abc123' });
  });

  it('parses multiple cookies', () => {
    const result = parseCookies('__session=abc123; other=value');
    expect(result).toEqual({ __session: 'abc123', other: 'value' });
  });

  it('handles null', () => {
    const result = parseCookies(null);
    expect(result).toEqual({});
  });

  it('handles empty string', () => {
    const result = parseCookies('');
    expect(result).toEqual({});
  });

  it('handles cookies with = in value', () => {
    const result = parseCookies('token=abc=def=ghi');
    expect(result).toEqual({ token: 'abc=def=ghi' });
  });

  it('trims whitespace around cookie names and values', () => {
    const result = parseCookies('  __session = abc123 ; other = value  ');
    expect(result.__session).toBeDefined();
  });
});

describe('validateFirebaseSessionCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invalid for malformed JWT', async () => {
    const result = await validateFirebaseSessionCookie('not-a-jwt', 'test-project');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns invalid for JWT without kid header', async () => {
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sub: 'user-123' }));
    const fakeJwt = `${header}.${payload}.signature`;

    const result = await validateFirebaseSessionCookie(fakeJwt, 'test-project');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('key ID');
  });
});
