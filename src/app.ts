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

  // Legacy convention: ALLOWED_ORIGINS='*' means force wildcard.
  const forceWildcard =
    (env.CORS_FORCE_WILDCARD ?? env.ALLOWED_ORIGINS)?.trim() === "*";

  return {
    allowedOrigins:
      fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_ORIGINS,
    forceWildcard,
  };
}

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  // Global middleware
  app.use("*", logger());

  // CORS (CRITICAL): must be applied before dashboard can fetch coverage reports.
  app.use("*", async (c, next) => {
    const corsConfig = resolveCorsConfig(c.env);

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

  // Auth middleware for all viewer routes
  app.use("/*", privateProjectAuth);

  // ZIP-based static file serving (primary)
  app.route("/", zipStaticRoutes);

  // 404 handler
  app.notFound((c) => {
    return c.text("Not Found", 404);
  });

  // Error handler
  app.onError((err, c) => {
    console.error("Application error:", err);
    return c.text("Internal Server Error", 500);
  });

  return app;
}
