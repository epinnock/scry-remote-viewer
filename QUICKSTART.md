# Quick Start Guide

Get the Scry CDN Service running in minutes!

## 🚀 Choose Your Platform

### Option 1: Cloudflare Workers (Recommended for Production)

```bash
# 1. Install dependencies
cd scry-cdn-service
npm install

# 2. Create R2 bucket
npx wrangler r2 bucket create scry-static-sites

# 3. Create KV namespace for caching
npx wrangler kv:namespace create CDN_CACHE
npx wrangler kv:namespace create CDN_CACHE --preview

# 4. Update cloudflare/wrangler.toml with the KV namespace IDs from step 3

# 5. Run locally
npm run dev:cloudflare

# 6. Test (in another terminal)
curl http://localhost:8787/health

# 7. Deploy to production
npm run deploy:cloudflare
```

### Option 2: Docker (Recommended for Self-Hosting)

```bash
# 1. Install dependencies
cd scry-cdn-service
npm install

# 2. Create .env file
cp .env.example .env

# 3. Edit .env with your settings
nano .env  # or your preferred editor

# 4. Run with Docker Compose
npm run docker:run

# 5. Test
curl http://localhost:3000/health

# 6. Build production image
npm run docker:build

# 7. Deploy to your infrastructure
docker tag scry-cdn-service:latest your-registry/scry-cdn-service:latest
docker push your-registry/scry-cdn-service:latest
```

## 📝 Configuration

### Cloudflare Workers

1. **DNS Setup:**
   - Add wildcard AAAA record: `*` → `100::`
   - Enable Proxy
   - Zone: Your domain (e.g., `mysite.com`)

2. **Worker Route:**
   - Pattern: `view-*.mysite.com/*`
   - Already configured in `wrangler.toml`

3. **Secrets:**
   ```bash
   # Set Firebase credentials
   npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
   # Paste your service account JSON when prompted
   
   npx wrangler secret put FIREBASE_API_KEY
   # Paste your API key when prompted
   ```

### Docker

1. **Environment Variables:**
   ```bash
   # Required
   FIREBASE_PROJECT_ID=scry-dev-dashboard
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
   
   # Storage (choose one)
   STORAGE_TYPE=filesystem
   STORAGE_PATH=/data/static-sites
   
   # OR for S3
   STORAGE_TYPE=s3
   AWS_S3_BUCKET=your-bucket
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=xxx
   AWS_SECRET_ACCESS_KEY=xxx
   ```

2. **Volume Setup:**
   ```bash
   # Create data directory
   mkdir -p /var/data/static-sites
   
   # Run with volume mount
   docker run -d \
     -p 3000:3000 \
     -v /var/data/static-sites:/data \
     scry-cdn-service:latest
   ```

## 🧪 Testing

### Upload Test Files

**For Cloudflare R2:**
```bash
# Create test files
mkdir -p test-site
echo '<h1>Hello from CDN!</h1>' > test-site/index.html

# Upload to R2 (replace test-uuid with your project ID)
npx wrangler r2 object put scry-static-sites/test-uuid/index.html \
  --file=test-site/index.html

# Test
curl https://view-test-uuid.mysite.com/
```

**For Docker Filesystem:**
```bash
# Create test files in container volume
docker exec scry-cdn-service mkdir -p /data/static-sites/test-uuid
docker exec scry-cdn-service sh -c 'echo "<h1>Hello from CDN!</h1>" > /data/static-sites/test-uuid/index.html'

# Test
curl http://view-test-uuid.localhost:3000/
```

### Health Checks

```bash
# Check service health
curl http://localhost:3000/health

# Check readiness (storage connectivity)
curl http://localhost:3000/health/ready
```

## 🔗 Integration with Build Service

Update your Next.js build service:

```typescript
// lib/services/build.service.ts
async createBuild(
  projectId: string,
  userId: string,
  data: CreateBuildData
): Promise<Build> {
  // ... existing code ...
  
  const buildData = {
    projectId,
    versionId: data.versionId,
    buildNumber,
    zipUrl: data.zipUrl,
    // 🆕 Add viewer URL
    viewerUrl: `https://view-${projectId}.mysite.com`,
    status: 'active' as const,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: userId,
  };
  
  // ... rest of code
}
```

## 📊 Monitoring

### Cloudflare

```bash
# View real-time logs
npx wrangler tail

# View analytics in dashboard
# https://dash.cloudflare.com → Workers → scry-cdn-service
```

### Docker

```bash
# View logs
docker logs -f scry-cdn-service

# Monitor health
watch -n 5 'curl -s http://localhost:3000/health | jq'
```

## 🐛 Common Issues

### "Invalid subdomain format"
- Ensure URL matches pattern: `view-{uuid}.domain.com`
- Check DNS wildcard is configured
- Verify Worker route pattern in Cloudflare

### "Not Found" errors
- Check storage key format: `{uuid}/{filepath}`
- Verify files exist in storage
- Test with health endpoint first

### CORS errors
- Check `ALLOWED_ORIGINS` environment variable
- Verify CORS middleware is active
- Review browser developer console

## 📚 Next Steps

1. **Set up CI/CD:**
   - GitHub Actions for automated deployment
   - Automated testing pipeline

2. **Add monitoring:**
   - Sentry for error tracking
   - Custom analytics endpoint

3. **Optimize performance:**
   - Enable edge caching
   - Implement cache warming
   - Add compression for large files

4. **Enhance security:**
   - Add rate limiting
   - Implement authentication (if needed)
   - Set up WAF rules (Cloudflare)

## 📖 Documentation

- [Full README](./README.md)
- [Architecture Guide](../md/HONO_CDN_SERVICE_ARCHITECTURE.md)
- [Architecture Decision](../md/R2_WORKER_ARCHITECTURE_DECISION.md)

## 💡 Tips

- Use `view-*` subdomain pattern for easy identification
- Set long cache TTLs for immutable content
- Monitor R2/S3 costs with usage dashboards
- Test locally before deploying to production
- Keep secrets in environment variables, never in code

---

**Need help?** Check the [README](./README.md) or open an issue!