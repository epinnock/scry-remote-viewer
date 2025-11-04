# Quick Start Guide

## Cloudflare Deployment (Recommended)

### ⚠️ Authentication Issue Fix

If you're getting authentication errors, use **interactive login** instead of API tokens:

```bash
npx wrangler login
```

This opens a browser for OAuth authentication - much more reliable than API tokens.

### Quick Deploy (After Login)
```bash
# Interactive deployment wizard
npm run deploy:setup
```

This script will guide you through:
1. ✅ Authentication check
2. 📦 Creating R2 buckets
3. 🗄️ Creating KV namespaces  
4. 🚀 Deploying to Cloudflare Workers

### Manual Deployment
For detailed step-by-step instructions, see [`DEPLOYMENT.md`](DEPLOYMENT.md)

Or use these commands directly:
```bash
# 1. Login (recommended)
npx wrangler login

# 2. Create resources
npx wrangler r2 bucket create scry-static-sites
npx wrangler kv:namespace create CDN_CACHE

# 3. Update wrangler.toml with KV IDs (it will print them)

# 4. Deploy
npm run deploy:cloudflare
```

### After Deployment
1. Configure DNS wildcard record: `view-*` → `100::`
2. Upload test ZIP: `npx wrangler r2 object put scry-static-sites/abc123.zip --file=test.zip`
3. Visit: `https://view-abc123.yourdomain.com`

---

Get the Scry CDN Service running in minutes with ZIP-based static site serving!

## 🚀 Choose Your Platform

### Option 1: Cloudflare Workers (Recommended for Production)

```bash
# 1. Install dependencies
cd scry-cdn-service
npm install

# 2. Create R2 bucket
npx wrangler r2 bucket create scry-static-sites

# 3. Create KV namespace for ZIP metadata caching
npx wrangler kv:namespace create CDN_CACHE
npx wrangler kv:namespace create CDN_CACHE --preview

# 4. Update cloudflare/wrangler.toml with the KV namespace IDs from step 3

# 5. Run locally (choose one method):
npm run dev:cloudflare              # Runs from cloudflare directory
# OR
npm run dev:cloudflare:local        # Runs from project root
# OR
cd cloudflare && npx wrangler dev --remote

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
   
   # ZIP extraction (enabled by default)
   ZIP_EXTRACTION_ENABLED=true
   ZIP_CACHE_TTL=86400
   ZIP_MAX_FILE_SIZE=10485760
   
   # Storage (choose one)
   STORAGE_TYPE=filesystem
   STORAGE_PATH=/data/static-sites
   
   # OR for R2
   STORAGE_TYPE=r2
   R2_BUCKET=your-bucket
   R2_ACCOUNT_ID=your-cloudflare-account-id
   R2_ACCESS_KEY_ID=xxx
   R2_SECRET_ACCESS_KEY=xxx
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

## 🧪 Testing with ZIP Archives

### Create and Upload Test ZIP

**Step 1: Create a test site**
```bash
# Create test files
mkdir -p test-site
echo '<h1>Hello from Scry CDN!</h1>' > test-site/index.html
echo '<p>About page</p>' > test-site/about.html
mkdir -p test-site/assets
echo 'body { color: blue; }' > test-site/assets/style.css

# Create ZIP archive
cd test-site
zip -r ../test-uuid.zip *
cd ..
```

**Step 2: Upload to R2 (Cloudflare)**
```bash
# Upload ZIP to R2
npx wrangler r2 object put scry-static-sites/test-uuid.zip \
  --file=test-uuid.zip

# The ZIP will be automatically extracted on-demand when accessed
```

**Step 3: Test locally with subdomain routing**

```bash
# Option A: Using curl with Host header
curl -H "Host: view-test-uuid.localhost:8787" \
  http://localhost:8787/index.html

# Option B: Add to /etc/hosts
echo "127.0.0.1 view-test-uuid.localhost" | sudo tee -a /etc/hosts

# Then access in browser
open http://view-test-uuid.localhost:8787
```

**Step 4: Verify ZIP extraction**

```bash
# Check different file paths
curl -H "Host: view-test-uuid.localhost:8787" http://localhost:8787/index.html
curl -H "Host: view-test-uuid.localhost:8787" http://localhost:8787/about.html
curl -H "Host: view-test-uuid.localhost:8787" http://localhost:8787/assets/style.css

# Test SPA fallback
curl -H "Host: view-test-uuid.localhost:8787" http://localhost:8787/some-route
# Should fallback to index.html
```

### Docker Testing

```bash
# For Docker (port 3000)
curl -H "Host: view-test-uuid.localhost:3000" \
  http://localhost:3000/index.html
```

### Health Checks

```bash
# Check service health
curl http://localhost:8787/health  # Cloudflare
curl http://localhost:3000/health  # Docker

# Response should be:
# {"status":"healthy","service":"scry-cdn-service","platform":"cloudflare",...}
```

## 🔗 Integration with Build Service

Update your Next.js build service to upload ZIPs and generate viewer URLs:

```typescript
// lib/services/build.service.ts
async createBuild(
  projectId: string,
  userId: string,
  data: CreateBuildData
): Promise<Build> {
  // 1. Build generates a ZIP file (e.g., storybook-static.zip)
  const zipPath = await buildStorybook(projectId);
  
  // 2. Upload ZIP to R2
  await uploadToR2(`${projectId}.zip`, zipPath);
  
  // 3. Create build record with viewer URL
  const buildData = {
    projectId,
    versionId: data.versionId,
    buildNumber,
    zipUrl: `r2://scry-static-sites/${projectId}.zip`,
    // 🆕 Viewer URL uses subdomain routing
    viewerUrl: `https://view-${projectId}.mysite.com`,
    status: 'active' as const,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: userId,
  };
  
  await db.collection('builds').add(buildData);
  return buildData;
}
```

## 📊 How It Works

### ZIP Extraction Flow

1. **Request arrives:** `https://view-abc123.mysite.com/index.html`
2. **Parse subdomain:** Extract `abc123` as ZIP key
3. **Check KV cache:** Look for central directory metadata (`cd:abc123.zip`)
4. **On cache miss:** 
   - Read ZIP central directory from R2 using range requests
   - Cache metadata in KV for 24 hours
5. **Locate file:** Find `index.html` in central directory
6. **Extract file:** Fetch only the compressed bytes using R2 range request
7. **Decompress:** Inflate if needed (supports stored & deflate)
8. **Serve:** Return with proper MIME type and cache headers

### Performance

- **First request:** ~62ms (includes central directory caching)
- **Cached requests:** ~31ms (metadata from KV, file from R2)
- **Data savings:** ~50× less than downloading full ZIP

## 📊 Monitoring

### Cloudflare

```bash
# View real-time logs (shows ZIP extraction)
npx wrangler tail

# View analytics in dashboard
# https://dash.cloudflare.com → Workers → scry-cdn-service
# Monitor: KV hit rate, R2 requests, response times
```

### Docker

```bash
# View logs (includes extraction details)
docker logs -f scry-cdn-service

# Monitor health
watch -n 5 'curl -s http://localhost:3000/health | jq'
```

## 🐛 Common Issues

### "ZIP file not found"
- Ensure ZIP exists at `{uuid}.zip` in R2 bucket
- Check subdomain format: `view-{uuid}.domain.com`
- Verify R2 bucket binding in wrangler.toml

### "File not found in ZIP"
- Check file path is correct (case-sensitive)
- Verify file exists in ZIP archive: `unzip -l {uuid}.zip`
- Test SPA fallback: files without extensions try `/index.html`

### "Invalid subdomain format"
- Ensure URL matches pattern: `view-{uuid}.domain.com`
- Check DNS wildcard is configured
- Verify Worker route pattern in Cloudflare

### CORS errors
- Check `ALLOWED_ORIGINS` environment variable
- Verify CORS middleware is active
- Review browser developer console

### Slow performance
- Check KV cache hit rate in Cloudflare dashboard
- Verify `ZIP_CACHE_TTL` is set appropriately (default: 24hr)
- Monitor R2 range request sizes

## 🔧 Advanced Configuration

### Clear ZIP Cache (after re-uploading)

```typescript
// In your upload script
import { clearCentralDirectoryCache } from './src/services/zip/central-directory';

// After uploading new ZIP
await clearCentralDirectoryCache(kv, `${projectId}.zip`);
```

### Custom Cache TTL

```bash
# In .env or wrangler.toml
ZIP_CACHE_TTL=43200  # 12 hours instead of default 24
```

### File Size Limits

```bash
# Prevent extraction of files larger than 10MB
ZIP_MAX_FILE_SIZE=10485760
```

## 📚 Next Steps

1. **Review Architecture:**
   - [Partial ZIP Architecture](docs/PARTIAL_ZIP_ARCHITECTURE.md)
   - [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
   - [Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md)

2. **Set up CI/CD:**
   - Automated ZIP uploads to R2
   - Deploy Workers on git push

3. **Add monitoring:**
   - Track extraction metrics
   - Monitor KV hit rates
   - Set up alerts for failures

4. **Optimize performance:**
   - Predictive caching for common files
   - Multi-region KV replication
   - Compression negotiation

## 📖 Documentation

- [Full README](./README.md) - Complete feature documentation
- [Partial ZIP Architecture](docs/PARTIAL_ZIP_ARCHITECTURE.md) - Technical deep-dive
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) - Deployment strategy
- [Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md) - Executive overview

## 💡 Tips

- Store each build as a single ZIP: `{project-uuid}.zip`
- Central directory metadata auto-caches for 24 hours
- Use versioned asset names for immutable caching
- Test locally with `/etc/hosts` or curl Host headers
- Monitor KV cache hit rate for optimization opportunities
- Clear cache manually after re-uploading ZIPs

---

**Need help?** Check the [README](./README.md) or open an issue!