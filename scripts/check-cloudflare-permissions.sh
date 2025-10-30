#!/bin/bash

# Script to test Cloudflare API token permissions
# This helps identify what your token can and cannot do

set +e  # Don't exit on errors

echo "🔍 Cloudflare API Token Permission Checker"
echo "=========================================="
echo ""

# Load token if available
if [ -f "secrets/cloudflare.login" ]; then
    source secrets/cloudflare.login
    export CLOUDFLARE_API_TOKEN
    echo "✓ Loaded token from secrets/cloudflare.login"
else
    echo "⚠ No secrets file found, checking current environment..."
fi

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "✗ CLOUDFLARE_API_TOKEN not set"
    echo ""
    echo "Set it with:"
    echo "  export CLOUDFLARE_API_TOKEN=your-token-here"
    exit 1
fi

echo "Token: ${CLOUDFLARE_API_TOKEN:0:10}...${CLOUDFLARE_API_TOKEN: -10}"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Testing permissions..."
echo ""

# Test 1: Account access
echo -n "1. Account Access (wrangler whoami): "
if npx wrangler whoami &>/dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL - Cannot access account${NC}"
fi

# Test 2: Workers list
echo -n "2. Workers Read (list deployments): "
if npx wrangler deployments list &>/dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL - Cannot list workers${NC}"
fi

# Test 3: R2 list
echo -n "3. R2 Read (list buckets): "
if npx wrangler r2 bucket list &>/dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL - Cannot list R2 buckets${NC}"
fi

# Test 4: KV list
echo -n "4. KV Read (list namespaces): "
if npx wrangler kv:namespace list &>/dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL - Cannot list KV namespaces${NC}"
fi

echo ""
echo "=========================================="
echo ""
echo "Required permissions for deployment:"
echo "  ✓ Account → Workers Scripts → Edit"
echo "  ✓ Account → Account Settings → Read"
echo "  ✓ Zone → Workers Routes → Edit"
echo "  ✓ Account → Workers KV Storage → Edit"
echo "  ✓ Account → R2 → Edit"
echo ""
echo "To view/edit your token permissions:"
echo "  https://dash.cloudflare.com/profile/api-tokens"
echo ""
echo "Or use interactive login instead:"
echo "  npx wrangler login"