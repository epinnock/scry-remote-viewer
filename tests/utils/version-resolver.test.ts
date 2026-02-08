import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveVersion } from "@/utils/version-resolver";
import type { Env } from "@/types/env";

function createMockR2Object(key: string, uploaded: Date) {
  return {
    key,
    uploaded,
    version: "v1",
    size: 1000,
    etag: "etag",
    httpEtag: '"etag"',
    checksums: {},
  };
}

function createMockBucket(objects: ReturnType<typeof createMockR2Object>[]) {
  return {
    list: vi.fn().mockResolvedValue({
      objects,
      truncated: false,
      cursor: undefined,
    }),
  };
}

function createMockKV(store: Record<string, string> = {}) {
  return {
    get: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
    put: vi.fn().mockResolvedValue(undefined),
  };
}

describe("resolveVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns version as-is for non-latest versions", async () => {
    const env = {} as Env;
    const result = await resolveVersion("my-project", "main", env);
    expect(result).toEqual({ resolvedVersion: "main" });
  });

  it("returns version as-is for semantic versions", async () => {
    const env = {} as Env;
    const result = await resolveVersion("my-project", "v1.0.0", env);
    expect(result).toEqual({ resolvedVersion: "v1.0.0" });
  });

  it("resolves latest to most recent version from R2", async () => {
    const bucket = createMockBucket([
      createMockR2Object(
        "my-project/v1.0.0/storybook.zip",
        new Date("2025-01-01"),
      ),
      createMockR2Object(
        "my-project/v2.0.0/storybook.zip",
        new Date("2025-06-01"),
      ),
      createMockR2Object(
        "my-project/main/storybook.zip",
        new Date("2025-03-01"),
      ),
    ]);

    const env = {
      UPLOAD_BUCKET: bucket,
    } as unknown as Env;

    const result = await resolveVersion("my-project", "latest", env);
    expect(result).toEqual({ resolvedVersion: "v2.0.0" });
  });

  it("returns null when no builds exist", async () => {
    const bucket = createMockBucket([]);

    const env = {
      UPLOAD_BUCKET: bucket,
    } as unknown as Env;

    const result = await resolveVersion("my-project", "latest", env);
    expect(result).toBeNull();
  });

  it("returns null when UPLOAD_BUCKET is not available", async () => {
    const env = {} as Env;
    const result = await resolveVersion("my-project", "latest", env);
    expect(result).toBeNull();
  });

  it("ignores objects that are not storybook.zip", async () => {
    const bucket = createMockBucket([
      createMockR2Object(
        "my-project/v1.0.0/coverage-report.json",
        new Date("2025-06-01"),
      ),
      createMockR2Object(
        "my-project/main/storybook.zip",
        new Date("2025-01-01"),
      ),
    ]);

    const env = {
      UPLOAD_BUCKET: bucket,
    } as unknown as Env;

    const result = await resolveVersion("my-project", "latest", env);
    expect(result).toEqual({ resolvedVersion: "main" });
  });

  it("skips objects with version 'latest' to avoid self-reference", async () => {
    const bucket = createMockBucket([
      createMockR2Object(
        "my-project/latest/storybook.zip",
        new Date("2025-12-01"),
      ),
      createMockR2Object(
        "my-project/main/storybook.zip",
        new Date("2025-01-01"),
      ),
    ]);

    const env = {
      UPLOAD_BUCKET: bucket,
    } as unknown as Env;

    const result = await resolveVersion("my-project", "latest", env);
    expect(result).toEqual({ resolvedVersion: "main" });
  });

  describe("caching", () => {
    it("uses cached value when available", async () => {
      const cache = createMockKV({
        "latest:my-project": JSON.stringify({ resolvedVersion: "v3.0.0" }),
      });
      const bucket = createMockBucket([]);

      const env = {
        CDN_CACHE: cache,
        UPLOAD_BUCKET: bucket,
      } as unknown as Env;

      const result = await resolveVersion("my-project", "latest", env);
      expect(result).toEqual({ resolvedVersion: "v3.0.0" });
      expect(bucket.list).not.toHaveBeenCalled();
    });

    it("writes to cache after resolving from R2", async () => {
      const cache = createMockKV();
      const bucket = createMockBucket([
        createMockR2Object(
          "my-project/main/storybook.zip",
          new Date("2025-01-01"),
        ),
      ]);

      const env = {
        CDN_CACHE: cache,
        UPLOAD_BUCKET: bucket,
      } as unknown as Env;

      await resolveVersion("my-project", "latest", env);

      expect(cache.put).toHaveBeenCalledWith(
        "latest:my-project",
        JSON.stringify({ resolvedVersion: "main" }),
        { expirationTtl: 60 },
      );
    });

    it("does not write to cache when resolution fails", async () => {
      const cache = createMockKV();
      const bucket = createMockBucket([]);

      const env = {
        CDN_CACHE: cache,
        UPLOAD_BUCKET: bucket,
      } as unknown as Env;

      const result = await resolveVersion("my-project", "latest", env);
      expect(result).toBeNull();
      expect(cache.put).not.toHaveBeenCalled();
    });

    it("falls through to R2 when cache has invalid JSON", async () => {
      const cache = createMockKV({
        "latest:my-project": "not-valid-json",
      });
      const bucket = createMockBucket([
        createMockR2Object(
          "my-project/v1.0.0/storybook.zip",
          new Date("2025-01-01"),
        ),
      ]);

      const env = {
        CDN_CACHE: cache,
        UPLOAD_BUCKET: bucket,
      } as unknown as Env;

      const result = await resolveVersion("my-project", "latest", env);
      expect(result).toEqual({ resolvedVersion: "v1.0.0" });
    });

    it("works without cache (CDN_CACHE not bound)", async () => {
      const bucket = createMockBucket([
        createMockR2Object(
          "my-project/main/storybook.zip",
          new Date("2025-01-01"),
        ),
      ]);

      const env = {
        UPLOAD_BUCKET: bucket,
      } as unknown as Env;

      const result = await resolveVersion("my-project", "latest", env);
      expect(result).toEqual({ resolvedVersion: "main" });
    });
  });

  describe("pagination", () => {
    it("handles paginated R2 results", async () => {
      const bucket = {
        list: vi
          .fn()
          .mockResolvedValueOnce({
            objects: [
              createMockR2Object(
                "my-project/v1.0.0/storybook.zip",
                new Date("2025-01-01"),
              ),
            ],
            truncated: true,
            cursor: "page2",
          })
          .mockResolvedValueOnce({
            objects: [
              createMockR2Object(
                "my-project/v2.0.0/storybook.zip",
                new Date("2025-06-01"),
              ),
            ],
            truncated: false,
            cursor: undefined,
          }),
      };

      const env = {
        UPLOAD_BUCKET: bucket,
      } as unknown as Env;

      const result = await resolveVersion("my-project", "latest", env);
      expect(result).toEqual({ resolvedVersion: "v2.0.0" });
      expect(bucket.list).toHaveBeenCalledTimes(2);
    });
  });
});
