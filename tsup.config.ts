import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'cloudflare/worker': 'cloudflare/worker.ts',
    'docker/server': 'docker/server.ts',
  },
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  external: ['hono', '@hono/node-server'],
});