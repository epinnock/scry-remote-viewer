#!/bin/bash

# Script to fix Storybook ZIP structure and upload to R2
# This removes the storybook-static/ prefix and puts files at root

set -e

echo "🔧 Fix and Upload Storybook ZIP"
echo "================================"
echo ""

# Configuration
PROJECT="design-system"
OLD_VERSION="v1.0.0"
NEW_VERSION="v1.0.1"
BUCKET="my-storybooks-production"
TEMP_DIR="/tmp/storybook-fix-$$"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Download current ZIP from R2
echo -e "${YELLOW}Step 1: Downloading current ZIP from R2...${NC}"
mkdir -p "$TEMP_DIR"
npx wrangler r2 object get "$BUCKET/$PROJECT/$OLD_VERSION/storybook.zip" \
  --file="$TEMP_DIR/original.zip"
echo -e "${GREEN}✓ Downloaded${NC}"
echo ""

# Step 2: Extract ZIP
echo -e "${YELLOW}Step 2: Extracting ZIP...${NC}"
cd "$TEMP_DIR"
unzip -q original.zip
echo -e "${GREEN}✓ Extracted${NC}"
echo ""

# Step 3: Check structure
echo -e "${YELLOW}Step 3: Checking structure...${NC}"
if [ -d "storybook-static" ]; then
    echo "Found storybook-static/ directory - will flatten structure"
    cd storybook-static
else
    echo "Files are already at root - structure is correct"
fi
echo ""

# Step 4: Create fixed ZIP
echo -e "${YELLOW}Step 4: Creating fixed ZIP with files at root...${NC}"
zip -r "$TEMP_DIR/storybook-fixed.zip" .
echo -e "${GREEN}✓ Created fixed ZIP${NC}"
echo ""

# Step 5: Verify fixed ZIP structure
echo -e "${YELLOW}Step 5: Verifying fixed ZIP structure...${NC}"
echo "First 20 files in fixed ZIP:"
unzip -l "$TEMP_DIR/storybook-fixed.zip" | head -25
echo ""

# Check if index.html is at root
if unzip -l "$TEMP_DIR/storybook-fixed.zip" | grep -q "^.*index.html$"; then
    echo -e "${GREEN}✓ index.html found at root level${NC}"
else
    echo -e "${RED}✗ WARNING: index.html not found at root level${NC}"
    exit 1
fi
echo ""

# Step 6: Upload to R2 as new version
echo -e "${YELLOW}Step 6: Uploading to R2 as $NEW_VERSION...${NC}"
npx wrangler r2 object put "$BUCKET/$PROJECT/$NEW_VERSION/storybook.zip" \
  --file="$TEMP_DIR/storybook-fixed.zip"
echo -e "${GREEN}✓ Uploaded to $BUCKET/$PROJECT/$NEW_VERSION/storybook.zip${NC}"
echo ""

# Step 7: Display viewer URL
echo -e "${GREEN}✓ Upload complete!${NC}"
echo ""
echo "Your Storybook is now available at:"
echo -e "${GREEN}https://view.scrymore.com/design-system-v1-0-1/${NC}"
echo ""
echo "Test it with:"
echo "  curl -I https://view.scrymore.com/design-system-v1-0-1/"
echo ""

# Cleanup
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"
echo -e "${GREEN}✓ Done${NC}"