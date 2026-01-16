import * as jose from "jose";

const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys";

const GOOGLE_KEYS_CACHE_KEY = "firebase:public-keys";

async function getGooglePublicKeys(
  cache?: KVNamespace,
): Promise<Record<string, string>> {
  if (cache) {
    const cached = (await cache.get(GOOGLE_KEYS_CACHE_KEY, "json")) as {
      keys: Record<string, string>;
    } | null;
    if (cached?.keys && Object.keys(cached.keys).length > 0) {
      return cached.keys;
    }
  }

  const response = await fetch(GOOGLE_CERTS_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch Google public keys: ${response.status}`);
  }

  const keys = (await response.json()) as Record<string, string>;

  const cacheControl = response.headers.get("Cache-Control");
  let maxAge = 3600;

  if (cacheControl) {
    const match = cacheControl.match(/max-age=(\d+)/);
    if (match) {
      maxAge = Number.parseInt(match[1], 10);
    }
  }

  if (cache) {
    await cache.put(GOOGLE_KEYS_CACHE_KEY, JSON.stringify({ keys }), {
      expirationTtl: maxAge,
    });
  }

  return keys;
}

export interface SessionValidationResult {
  valid: boolean;
  uid?: string;
  email?: string;
  error?: string;
}

export async function validateFirebaseSessionCookie(
  sessionCookie: string,
  firebaseProjectId: string,
  cache?: KVNamespace,
): Promise<SessionValidationResult> {
  try {
    const header = jose.decodeProtectedHeader(sessionCookie);

    if (!header.kid) {
      return { valid: false, error: "Missing key ID in JWT header" };
    }

    const publicKeys = await getGooglePublicKeys(cache);
    const publicKeyPem = publicKeys[header.kid];

    if (!publicKeyPem) {
      return { valid: false, error: "Unknown key ID" };
    }

    const publicKey = await jose.importX509(publicKeyPem, "RS256");

    const { payload } = await jose.jwtVerify(sessionCookie, publicKey, {
      issuer: `https://session.firebase.google.com/${firebaseProjectId}`,
      audience: firebaseProjectId,
    });

    const uid = payload.sub;
    const email = payload.email as string | undefined;

    if (!uid) {
      return { valid: false, error: "Missing user ID in token" };
    }

    return {
      valid: true,
      uid,
      email,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[AUTH] Session validation failed:", message);
    return { valid: false, error: message };
  }
}

export function parseCookies(
  cookieHeader: string | null,
): Record<string, string> {
  if (!cookieHeader) return {};

  const cookies: Record<string, string> = {};

  cookieHeader.split(";").forEach((cookie) => {
    const [rawName, ...rest] = cookie.split("=");
    const name = rawName?.trim();
    const value = rest.join("=").trim();
    if (name) {
      cookies[name] = value;
    }
  });

  return cookies;
}
