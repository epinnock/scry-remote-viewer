# GitHub Actions Deployment Setup

This guide explains how to configure GitHub Actions for automated Cloudflare Workers deployment.

## Required GitHub Secrets

You need to configure the following secrets in your GitHub repository:

### 1. CLOUDFLARE_API_TOKEN

A Cloudflare API token with the following permissions:
- **Account → Workers Scripts → Edit**
- **Account → Account Settings → Read**
- **Zone → Workers Routes → Edit**
- **Account → Workers KV Storage → Edit**
- **Account → R2 → Edit**

**How to create:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template
4. Add the additional permissions listed above
5. Copy the generated token

### 2. CLOUDFLARE_ACCOUNT_ID

Your Cloudflare account ID.

**How to find:**
1. Go to https://dash.cloudflare.com
2. Select your account
3. The account ID is in the URL: `https://dash.cloudflare.com/{account_id}/...`
4. Or find it in the right sidebar of any zone's overview page

The account ID for this project is: `f54b9c10de9d140756dbf449aa124f1e`

## Repository Secrets vs Environment Secrets

GitHub offers two places to store secrets:

### Repository Secrets (Recommended for this project)
- **Location**: Settings → Secrets and variables → Actions → Repository secrets
- **Scope**: Available to all workflows in the repository
- **Use when**: Secret is the same across all environments (staging, production)

### Environment Secrets
- **Location**: Settings → Environments → [env name] → Environment secrets
- **Scope**: Only available when workflow runs in that specific environment
- **Use when**: Secret values differ between environments

**Rule of thumb:**
- Use **Repository Secrets** when the value is the same everywhere (like `CLOUDFLARE_ACCOUNT_ID`)
- Use **Environment Secrets** when values differ per environment (like different API keys for staging vs production)

For this project, use **Repository Secrets** for both:
- `CLOUDFLARE_API_TOKEN` - Same token deploys to both staging and production
- `CLOUDFLARE_ACCOUNT_ID` - Same account for all environments

## Wrangler Secrets (Runtime Secrets in Cloudflare)

These are **completely different** from GitHub secrets. Wrangler secrets are:
- Stored in Cloudflare's infrastructure (not GitHub)
- Available to your worker code at runtime
- Set using the Wrangler CLI, not the GitHub UI
- **Optional** for this CDN service

### Firebase Authentication (Optional)

If you want to enable Firebase authentication for protected routes:

```bash
# Set Firebase service account JSON
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT --env production
# Paste your Firebase service account JSON when prompted

# Set Firebase API key
npx wrangler secret put FIREBASE_API_KEY --env production
# Paste your Firebase API key when prompted
```

### How to Set Wrangler Secrets

Wrangler secrets are encrypted and stored in Cloudflare, not in your repository. Set them using the Wrangler CLI:

```bash
# For production environment
npx wrangler secret put SECRET_NAME --env production

# For development environment
npx wrangler secret put SECRET_NAME --env development

# List existing secrets
npx wrangler secret list --env production
```

### Summary of All Secrets

| Secret | Where to Set | Required | When Used |
|--------|--------------|----------|-----------|
| `CLOUDFLARE_API_TOKEN` | GitHub Repository Secrets | ✅ Yes | During deployment (GitHub Actions) |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Repository Secrets | ✅ Yes | During deployment (GitHub Actions) |
| `FIREBASE_SERVICE_ACCOUNT` | Wrangler Secrets (Cloudflare) | ❌ No | At runtime (worker code) |
| `FIREBASE_API_KEY` | Wrangler Secrets (Cloudflare) | ❌ No | At runtime (worker code) |

## Setting Up Secrets in GitHub

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:

| Secret Name | Value |
|-------------|-------|
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | `f54b9c10de9d140756dbf449aa124f1e` |

## GitHub Environments (Optional but Recommended)

For better deployment control, set up GitHub Environments:

### Production Environment
1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name it `production`
4. Configure:
   - **Required reviewers**: Add team members who must approve production deployments
   - **Wait timer**: Optional delay before deployment
   - **Deployment branches**: Restrict to `main` branch only

### Staging Environment
1. Create another environment named `staging`
2. Configure with less restrictive settings for PR previews

### Development Environment
1. Create environment named `development`
2. Used for manual workflow dispatch deployments

## Workflow Triggers

The deployment workflow triggers on:

| Trigger | Action |
|---------|--------|
| Push to `main` (scry-cdn-service changes) | Deploy to **production** |
| Pull request to `main` (scry-cdn-service changes) | Deploy to **staging** |
| Manual workflow dispatch | Deploy to selected environment |

## Manual Deployment

To manually trigger a deployment:

1. Go to **Actions** tab in GitHub
2. Select "Deploy CDN Service to Cloudflare" workflow
3. Click **Run workflow**
4. Select the environment (production or development)
5. Click **Run workflow**

## Verifying Deployment

After deployment, verify the service is running:

```bash
# Production
curl https://view.scrymore.com/health

# Development/Staging
curl https://scry-cdn-service-dev.scrymore.workers.dev/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "scry-cdn-service",
  "platform": "cloudflare",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Troubleshooting

### Authentication Errors

If you see `Unable to authenticate request [code: 10001]`:
- Verify the API token is correct
- Check token permissions include all required scopes
- Ensure the token hasn't expired

### Deployment Failures

1. Check the GitHub Actions logs for detailed error messages
2. Verify wrangler.toml configuration is correct
3. Ensure R2 buckets and KV namespaces exist

### Missing Secrets

If the workflow fails with "secret not found":
1. Verify secret names match exactly (case-sensitive)
2. Check secrets are set at repository level, not environment level (unless using environments)

## Workflow File Location

The workflow is defined in:
```
.github/workflows/deploy-cdn-service.yml
```

## Related Documentation

- [Cloudflare Wrangler Action](https://github.com/cloudflare/wrangler-action)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
