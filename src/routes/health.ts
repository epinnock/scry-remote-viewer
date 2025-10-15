import { Hono } from 'hono';
import type { Env } from '@/types/env';

export const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get('/', (c) => {
  return c.json({
    status: 'healthy',
    service: 'scry-cdn-service',
    platform: c.env.PLATFORM || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get('/ready', async (c) => {
  // Check storage connectivity
  try {
    const storage = await import('@/adapters/storage/factory').then(m => m.createStorageAdapter(c.env));
    
    return c.json({
      status: 'ready',
      checks: {
        storage: 'ok',
      },
    });
  } catch (error) {
    return c.json({
      status: 'not ready',
      checks: {
        storage: 'failed',
        error: String(error),
      },
    }, 503);
  }
});