#!/bin/bash

# Script to help identify your Cloudflare API token
# This provides information to help you find the token in your Cloudflare dashboard

echo "🔍 Cloudflare Token Identifier"
echo "=============================="
echo ""

# Load token if available
if [ -f "secrets/cloudflare.login" ]; then
    source secrets/cloudflare.login
    export CLOUDFLARE_API_TOKEN
else
    echo "✗ secrets/cloudflare.login not found"
    exit 1
fi

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "✗ CLOUDFLARE_API_TOKEN not set"
    exit 1
fi

echo "Your token value (masked):"
echo "  ${CLOUDFLARE_API_TOKEN:0:10}...${CLOUDFLARE_API_TOKEN: -10}"
echo ""
echo "Length: ${#CLOUDFLARE_API_TOKEN} characters"
echo ""

# Try to get token info via whoami
echo "Querying Cloudflare API..."
echo ""

if npx wrangler whoami 2>/dev/null; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "How to find this token in Cloudflare Dashboard:"
    echo ""
    echo "1. Visit: https://dash.cloudflare.com/profile/api-tokens"
    echo ""
    echo "2. Look for a token that:"
    echo "   - Starts with: ${CLOUDFLARE_API_TOKEN:0:10}..."
    echo "   - Ends with: ...${CLOUDFLARE_API_TOKEN: -10}"
    echo ""
    echo "3. Check the 'Last Used' column - it should show 'Just now'"
    echo "   (because we just used it with 'wrangler whoami')"
    echo ""
    echo "4. The token name will be displayed in the list"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "To add missing permissions:"
    echo "  - If there's an 'Edit' button (pencil icon), click it"
    echo "  - If no 'Edit' button, you need to create a new token"
    echo ""
    echo "See docs/CLOUDFLARE_TOKEN_SETUP.md for detailed instructions"
else
    echo "✗ Failed to query Cloudflare API"
    echo ""
    echo "Your token may be invalid or expired."
    echo ""
    echo "To find it in the dashboard:"
    echo "1. Visit: https://dash.cloudflare.com/profile/api-tokens"
    echo "2. Look for tokens that match:"
    echo "   - Starts with: ${CLOUDFLARE_API_TOKEN:0:10}..."
    echo "   - Ends with: ...${CLOUDFLARE_API_TOKEN: -10}"
    echo ""
    echo "Recommendation: Create a new token instead"
    echo "  See: docs/CLOUDFLARE_TOKEN_SETUP.md"
fi