import type { Env } from "@/types/env";

export interface VersionResolution {
  resolvedVersion: string;
}

/**
 * Resolve "latest" to the most recent version by listing R2 objects.
 * For non-latest versions, returns the version as-is.
 */
export async function resolveVersion(
  projectId: string,
  version: string,
  env: Env,
): Promise<VersionResolution | null> {
  if (version !== "latest") {
    return { resolvedVersion: version };
  }

  const cache = env.CDN_CACHE as KVNamespace | undefined;
  const cacheKey = `latest:${projectId}`;

  // Check cache first
  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as VersionResolution;
      } catch {
        // Invalid cache entry, continue to resolve
      }
    }
  }

  // Resolve from R2 by listing objects under the project prefix
  const bucket = env.UPLOAD_BUCKET as R2Bucket | undefined;
  if (!bucket) {
    return null;
  }

  let latestVersion: string | null = null;
  let latestUploaded: Date | null = null;
  let cursor: string | undefined;

  do {
    const listed = await bucket.list({
      prefix: `${projectId}/`,
      cursor,
    });

    for (const obj of listed.objects) {
      if (!obj.key.endsWith("/storybook.zip")) continue;

      // Extract version from key: {projectId}/{version}/storybook.zip
      const parts = obj.key.split("/");
      if (parts.length < 3) continue;

      const objVersion = parts[1];
      if (objVersion === "latest") continue;

      if (!latestUploaded || obj.uploaded > latestUploaded) {
        latestUploaded = obj.uploaded;
        latestVersion = objVersion;
      }
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  if (!latestVersion) {
    return null;
  }

  const result: VersionResolution = { resolvedVersion: latestVersion };

  // Cache the result with a short TTL (60s)
  if (cache) {
    await cache.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 });
  }

  return result;
}
