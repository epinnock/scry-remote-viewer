import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { compress } from 'hono/compress';
import { staticRoutes } from './routes/static';
import { zipStaticRoutes } from './routes/zip-static';
import { healthRoutes } from './routes/health';
import type { Env } from './types/env';

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  // Global middleware
  app.use('*', logger());
  
  app.use('*', cors({
    origin: (origin) => {
      // In production, validate against ALLOWED_ORIGINS
      return origin;
    },
    allowMethods: ['GET', 'HEAD', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }));

  // Temporarily disabled for testing
  // app.use('*', compress());

  // Health check routes (no auth required)
  app.route('/health', healthRoutes);

  // ZIP-based static file serving (primary)
  app.route('/', zipStaticRoutes);

  // Fallback to extracted file serving (for compatibility)
  // app.route('/', staticRoutes);

  // 404 handler
  app.notFound((c) => {
    return c.text('Not Found', 404);
  });

  // Error handler
  app.onError((err, c) => {
    console.error('Application error:', err);
    return c.text('Internal Server Error', 500);
  });

  return app;
}