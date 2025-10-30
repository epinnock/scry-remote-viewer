# Cloudflare API Token Setup Guide

This guide shows you how to add the necessary permissions to your Cloudflare API token for deploying the CDN service.

## Current Token Status

Your token can access account information but is missing:
- ❌ Workers Scripts permissions
- ❌ R2 Storage permissions
- ❌ KV Storage permissions

## Option 1: Edit Existing Token (If Possible)

### Step-by-Step Instructions

1. **Open Cloudflare Dashboard**
   - Go to: https://dash.cloudflare.com/profile/api-tokens
   - You'll see your list of API tokens

2. **Find Your Token**
   - Look for your existing token in the list
   - Click the **"Edit"** button (pencil icon) next to it
   - **Note:** If there's no Edit button, the token cannot be modified - you'll need to create a new one (see Option 2)

3. **Add Required Permissions**
   
   Click **"+ Add more"** to add these permissions:

   **Account Permissions:**
   ```
   Account → Workers Scripts → Edit
   Account → Workers KV Storage → Edit
   Account → Account Settings → Read
   Account → R2 → Edit
   ```

   **Zone Permissions:**
   ```
   Zone → Workers Routes → Edit
   ```

4. **Save Changes**
   - Scroll down and click **"Continue to summary"**
   - Review the permissions
   - Click **"Update Token"**

5. **Test the Updated Token**
   ```bash
   npm run deploy:check
   ```

## Option 2: Create a New Token (Recommended)

If you can't edit the existing token, create a new one:

### Step-by-Step Instructions

1. **Go to API Tokens Page**
   - Visit: https://dash.cloudflare.com/profile/api-tokens
   - Click **"Create Token"** button

2. **Use the Workers Template**
   - Find **"Edit Cloudflare Workers"** template
   - Click **"Use template"**

3. **Customize Permissions**
   
   The template should include:
   - ✅ Account → Workers Scripts → Edit
   - ✅ Account → Account Settings → Read
   - ✅ Zone → Workers Routes → Edit

   **You need to add these manually:**
   
   Click **"+ Add more"** and add:
   
   **Account Permissions:**
   ```
   Account → Workers KV Storage → Edit
   Account → R2 → Edit
   ```

4. **Configure Account and Zone Resources**
   
   **Account Resources:**
   - Select: `Include` → `All accounts`
   - Or choose your specific account: `Epinnock@gmail.com's Account`

   **Zone Resources:**
   - Select: `Include` → `All zones` (if you want to use any domain)
   - Or choose specific zones you'll use for the CDN

5. **Set TTL (Optional)**
   - You can leave this blank for no expiration
   - Or set a specific expiration date

6. **Create the Token**
   - Click **"Continue to summary"**
   - Review all permissions:
     - ✅ Account → Workers Scripts → Edit
     - ✅ Account → Account Settings → Read
     - ✅ Account → Workers KV Storage → Edit
     - ✅ Account → R2 → Edit
     - ✅ Zone → Workers Routes → Edit
   - Click **"Create Token"**

7. **Copy the Token**
   - **IMPORTANT:** Copy the token immediately - you won't see it again!
   - The token looks like: `abcd1234efgh5678...`

8. **Update Your Secrets File**
   
   Edit `secrets/cloudflare.login`:
   ```bash
   CLOUDFLARE_API_TOKEN=your-new-token-here
   ```

   Or use this command:
   ```bash
   echo "CLOUDFLARE_API_TOKEN=your-new-token-here" > secrets/cloudflare.login
   ```

9. **Test the New Token**
   ```bash
   npm run deploy:check
   ```

   You should see all ✓ PASS results:
   ```
   1. Account Access: ✓ PASS
   2. Workers Read: ✓ PASS
   3. R2 Read: ✓ PASS
   4. KV Read: ✓ PASS
   ```

## Visual Checklist

When creating/editing your token, ensure you have:

```
Account Permissions:
  ✅ Workers Scripts → Edit
  ✅ Workers KV Storage → Edit
  ✅ Account Settings → Read
  ✅ R2 → Edit

Zone Permissions:
  ✅ Workers Routes → Edit

Account Resources:
  ✅ Include → All accounts (or your specific account)

Zone Resources:
  ✅ Include → All zones (or your specific zones)
```

## After Setting Up Token

Once your token has the correct permissions:

1. **Verify it works:**
   ```bash
   npm run deploy:check
   ```

2. **Deploy:**
   ```bash
   npm run deploy:setup
   ```

## Troubleshooting

### "Cannot edit this token"
- Some tokens can't be edited after creation
- Solution: Create a new token (Option 2)

### Still getting permission errors after update
- Wait 1-2 minutes for changes to propagate
- Verify you saved the file: `secrets/cloudflare.login`
- Re-export the token: `source scripts/setup-cloudflare-env.sh`
- Check again: `npm run deploy:check`

### Lost access to token
- You cannot view a token after creation
- Solution: Create a new token and update `secrets/cloudflare.login`

## Alternative: Use Interactive Login

If token management is too complex, use interactive OAuth login instead:

```bash
npx wrangler login
```

This handles all permissions automatically through the browser.

## Security Best Practices

1. **Never commit tokens to git**
   - ✅ `secrets/cloudflare.login` is in `.gitignore`
   - ❌ Don't add tokens to `.env` files that might be committed

2. **Use minimal permissions**
   - Only grant the permissions listed above
   - Don't use "All permissions" unless necessary

3. **Set expiration dates**
   - Consider setting a TTL for production tokens
   - Rotate tokens periodically

4. **Keep tokens secure**
   - Don't share tokens in chat/email
   - Store them in password managers
   - Revoke tokens you're not using

## Quick Reference: Required Permissions

Copy this checklist when creating tokens:

```
Account Permissions:
- Workers Scripts → Edit
- Workers KV Storage → Edit  
- Account Settings → Read
- R2 → Edit

Zone Permissions:
- Workers Routes → Edit
```

For more information, see Cloudflare's documentation:
- [API Token Permissions](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Workers API Documentation](https://developers.cloudflare.com/api/)