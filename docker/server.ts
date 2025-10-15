import { serve } from '@hono/node-server';
import { createApp } from '../src/app';

const app = createApp();

const port = parseInt(process.env.PORT || '3000');
const host = process.env.HOST || '0.0.0.0';

console.log(`🚀 Scry CDN Service starting...`);
console.log(`📦 Platform: Docker/Node.js`);
console.log(`🌐 Server: http://${host}:${port}`);
console.log(`💾 Storage: ${process.env.STORAGE_TYPE || 'filesystem'}`);

serve({
  fetch: app.fetch,
  port,
  hostname: host,
});

console.log(`✅ CDN service running on http://${host}:${port}`);