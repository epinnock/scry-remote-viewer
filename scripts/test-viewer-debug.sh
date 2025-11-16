#!/bin/bash

# Viewer Debugging Script
# Use this to diagnose issues with the viewer service

set -e

echo "🔍 Scry Viewer Service - Debug & Test"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT="design-system"
VERSION="v1.0.0"
COMPOUND_UUID="design-system-v1-0-0"
BUCKET="my-storybooks-production"
ZIP_PATH="design-system/v1.0.0/storybook.zip"

echo -e "${BLUE}Testing Configuration:${NC}"
echo "  Project: $PROJECT"
echo "  Version: $VERSION"
echo "  Compound UUID: $COMPOUND_UUID"
echo "  Bucket: $BUCKET"
echo "  Expected ZIP path: $ZIP_PATH"
echo ""

# Step 1: Verify the file exists in R2
echo -e "${YELLOW}Step 1: Verifying file exists in R2...${NC}"
echo "Expected location: $BUCKET/$ZIP_PATH"
echo ""
echo "Run this command to verify (requires authentication):"
echo -e "${GREEN}npx wrangler r2 object get $BUCKET/$ZIP_PATH --file=/tmp/test-download.zip${NC}"
echo ""
read -p "Press Enter when you've verified the file exists in R2..."
echo ""

# Step 2: Test the URL construction
echo -e "${YELLOW}Step 2: URL Construction Test${NC}"
echo "Your file is at: $BUCKET/$ZIP_PATH"
echo ""
echo "The viewer URL should be:"
echo -e "${GREEN}https://view.scrymore.com/$COMPOUND_UUID/${NC}"
echo -e "${GREEN}https://view.scrymore.com/$COMPOUND_UUID/index.html${NC}"
echo ""
echo "Path breakdown:"
echo "  - Compound UUID: $COMPOUND_UUID"
echo "  - Converts to: $PROJECT/$VERSION/storybook.zip"
echo "  - In bucket: $BUCKET"
echo ""

# Step 3: Test local development
echo -e "${YELLOW}Step 3: Testing in Local Development${NC}"
echo "Start local dev server with:"
echo -e "${GREEN}npm run dev:cloudflare${NC}"
echo ""
echo "Then test these URLs:"
echo "  http://localhost:8788/$COMPOUND_UUID/"
echo "  http://localhost:8788/$COMPOUND_UUID/index.html"
echo ""
read -p "Does it work locally? (y/n): " LOCAL_WORKS
echo ""

if [[ $LOCAL_WORKS == "n" ]]; then
    echo -e "${RED}❌ Local testing failed. Debug before deploying to production.${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo "  1. Verify the ZIP is in the correct bucket: $BUCKET"
    echo "  2. Verify the ZIP path: $ZIP_PATH"
    echo "  3. Check wrangler.toml has correct bucket bindings"
    echo "  4. Ensure ZIP contains index.html at root level"
    echo ""
    exit 1
fi

# Step 4: Check production deployment status
echo -e "${YELLOW}Step 4: Production Deployment Check${NC}"
echo "To check current production deployment:"
echo -e "${GREEN}cd cloudflare && npx wrangler deployments list --env production${NC}"
echo ""
read -p "Press Enter to continue..."
echo ""

# Step 5: Deploy to production
echo -e "${YELLOW}Step 5: Deploy to Production${NC}"
echo "Your authentication token should be in: secrets/cloudflare.login"
echo ""
echo "To deploy to production, run:"
echo -e "${GREEN}npm run deploy:cloudflare${NC}"
echo ""
echo "This will:"
echo "  1. Load API token from secrets/cloudflare.login"
echo "  2. Deploy to production environment"
echo "  3. Use the production bucket: $BUCKET"
echo ""
read -p "Deploy now? (y/n): " DEPLOY_NOW
echo ""

if [[ $DEPLOY_NOW == "y" ]]; then
    echo "Deploying..."
    npm run deploy:cloudflare
    echo ""
    echo -e "${GREEN}✓ Deployment complete!${NC}"
    echo ""
fi

# Step 6: Test production
echo -e "${YELLOW}Step 6: Test Production Viewer${NC}"
echo "After deployment, test these URLs:"
echo ""
echo -e "${GREEN}curl -I https://view.scrymore.com/$COMPOUND_UUID/${NC}"
echo -e "${GREEN}curl -I https://view.scrymore.com/$COMPOUND_UUID/index.html${NC}"
echo ""
echo "Expected response: HTTP 200 OK"
echo "Expected Content-Type: text/html"
echo ""
echo "Full test command:"
echo -e "${GREEN}curl -v https://view.scrymore.com/$COMPOUND_UUID/${NC}"
echo ""

# Step 7: Debugging 404 errors
echo -e "${YELLOW}Step 7: Debugging 404 Errors${NC}"
echo ""
echo "If you get 404, check:"
echo ""
echo "1. File exists in R2:"
echo "   npx wrangler r2 object get $BUCKET/$ZIP_PATH --file=/tmp/verify.zip"
echo ""
echo "2. Check Worker logs:"
echo "   npx wrangler tail --env production"
echo "   (Then make a request and watch the logs)"
echo ""
echo "3. Verify bucket binding:"
echo "   Check cloudflare/wrangler.toml has UPLOAD_BUCKET bound to $BUCKET"
echo ""
echo "4. Check ZIP structure:"
echo "   unzip -l /tmp/verify.zip | head -20"
echo "   (Should show index.html at root, not in a subdirectory)"
echo ""

echo -e "${GREEN}✓ Debug guide complete!${NC}"
echo ""
echo "Quick Reference:"
echo "  Local dev:   npm run dev:cloudflare"
echo "  Deploy prod: npm run deploy:cloudflare"
echo "  View logs:   npx wrangler tail --env production"
echo "  Test URL:    https://view.scrymore.com/$COMPOUND_UUID/"