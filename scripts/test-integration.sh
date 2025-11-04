#!/bin/bash

# Integration test script for Upload Service integration
# Tests both legacy (simple UUID) and new (compound UUID) patterns

set -e

echo "=================================="
echo "Upload Service Integration Tests"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Base URL (defaults to localhost, can be overridden)
BASE_URL="${BASE_URL:-http://localhost:8788}"

echo "Testing against: $BASE_URL"
echo ""

# Test 1: Legacy simple UUID pattern
echo "1. Testing legacy pattern (simple UUID)..."
echo "   URL: $BASE_URL/storybook/"
if curl -f -s -I "$BASE_URL/storybook/" > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓ Legacy pattern working${NC}"
else
    echo -e "   ${RED}✗ Legacy pattern failed${NC}"
fi
echo ""

# Test 2: Compound UUID pattern (root)
echo "2. Testing compound UUID pattern (root)..."
echo "   URL: $BASE_URL/design-system-v1-0-0/"
if curl -f -s -I "$BASE_URL/design-system-v1-0-0/" > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓ Compound UUID root working${NC}"
else
    echo -e "   ${RED}✗ Compound UUID root failed (expected if no data uploaded)${NC}"
fi
echo ""

# Test 3: Compound UUID with explicit file
echo "3. Testing compound UUID with file path..."
echo "   URL: $BASE_URL/design-system-v1-0-0/index.html"
if curl -f -s -I "$BASE_URL/design-system-v1-0-0/index.html" > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓ Compound UUID file access working${NC}"
else
    echo -e "   ${RED}✗ Compound UUID file access failed (expected if no data uploaded)${NC}"
fi
echo ""

# Test 4: Asset file access
echo "4. Testing asset access in compound UUID..."
echo "   URL: $BASE_URL/design-system-v1-0-0/assets/style.css"
if curl -f -s -I "$BASE_URL/design-system-v1-0-0/assets/style.css" > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓ Asset access working${NC}"
else
    echo -e "   ${RED}✗ Asset access failed (expected if no data uploaded)${NC}"
fi
echo ""

# Test 5: Different version
echo "5. Testing different version pattern..."
echo "   URL: $BASE_URL/my-app-v2-1-5/"
if curl -f -s -I "$BASE_URL/my-app-v2-1-5/" > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓ Different version pattern working${NC}"
else
    echo -e "   ${RED}✗ Different version pattern failed (expected if no data uploaded)${NC}"
fi
echo ""

# Test 6: Invalid UUID format
echo "6. Testing invalid UUID format (should return 400)..."
echo "   URL: $BASE_URL/invalid_chars!/"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/invalid_chars!/")
if [ "$HTTP_CODE" = "400" ]; then
    echo -e "   ${GREEN}✓ Invalid format correctly rejected${NC}"
else
    echo -e "   ${RED}✗ Invalid format not rejected (got $HTTP_CODE)${NC}"
fi
echo ""

echo "=================================="
echo "Tests completed!"
echo ""
echo "Note: Some tests may fail if test data hasn't been uploaded."
echo "To upload test data to staging:"
echo ""
echo "  npx wrangler r2 object put my-storybooks-staging/design-system/v1.0.0/storybook.zip \\"
echo "    --file=storybook-static.zip"
echo ""