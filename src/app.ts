import { Hono } from "hono";
import { logger } from "hono/logger";
import { compress } from "hono/compress";
import { zipStaticRoutes } from "./routes/zip-static";
import { healthRoutes } from "./routes/health";
import { privateProjectAuth } from "./middleware/auth";
import type { Env } from "./types/env";
import {
  corsHeaders,
  handleOptions,
  parseAllowedOrigins,
  DEFAULT_ALLOWED_ORIGINS,
} from "./middleware/cors";

function resolveCorsConfig(env: Env) {
  // Prefer explicit CORS_ALLOWED_ORIGINS, fallback to legacy ALLOWED_ORIGINS.
  const fromEnv =
    parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS) ??
    parseAllowedOrigins(env.ALLOWED_ORIGINS);

  // IMPORTANT: Do NOT force wildcard when using credentialed requests.
  // Browsers reject Access-Control-Allow-Origin='*' with credentials: include.
  // Only force wildcard if explicitly set via CORS_FORCE_WILDCARD=true.
  const forceWildcard = env.CORS_FORCE_WILDCARD === "true";

  const allowedOrigins =
    fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
  const debug = env.NODE_ENV !== "production";

  // Debug logging for CORS configuration
  if (debug) {
    console.log("[CORS] Config resolved:", {
      forceWildcard,
      allowedOrigins: allowedOrigins.slice(0, 5), // Log first 5 origins
      envCorsAllowedOrigins: env.CORS_ALLOWED_ORIGINS,
      envAllowedOrigins: env.ALLOWED_ORIGINS,
    });
  }

  return {
    allowedOrigins,
    forceWildcard,
    debug,
  };
}

export function createApp() {
  const app = new Hono<{
    Bindings: Env;
    Variables: { corsConfig: ReturnType<typeof resolveCorsConfig> };
  }>();

  // Global middleware
  app.use("*", logger());

  // Resolve CORS config once per request for reuse.
  app.use("*", async (c, next) => {
    const corsConfig = resolveCorsConfig(c.env);
    c.set("corsConfig", corsConfig);
    await next();
  });

  // CORS (CRITICAL): must be applied before dashboard can fetch coverage reports.
  app.use("*", async (c, next) => {
    const corsConfig = c.get("corsConfig") ?? resolveCorsConfig(c.env);

    // Handle preflight requests.
    if (c.req.method === "OPTIONS") {
      return handleOptions(c.req.raw, corsConfig);
    }

    try {
      await next();
    } finally {
      // Ensure CORS headers are present on all responses (including 404s).
      const cors = corsHeaders(c.req.raw, corsConfig);
      cors.forEach((value, key) => {
        c.res.headers.set(key, value);
      });
    }
  });

  // Temporarily disabled for testing
  // app.use('*', compress());

  // Health check routes (no auth required)
  app.route("/health", healthRoutes);

  // Auth middleware for viewer routes only (exclude /health)
  app.use("/:projectId/*", privateProjectAuth);

  // ZIP-based static file serving (primary)
  app.route("/", zipStaticRoutes);

  // 404 handler
  app.notFound((c) => {
    return c.text("Not Found", 404);
  });

  // Error handler
  app.onError((err, c) => {
    console.error("Application error:", err);
    // Ensure CORS headers are present on error responses as well
    const corsConfig = c.get("corsConfig") ?? resolveCorsConfig(c.env);
    const cors = corsHeaders(c.req.raw, corsConfig);
    cors.forEach((value, key) => {
      c.res.headers.set(key, value);
    });
    return c.text("Internal Server Error", 500);
  });

  return app;
}
