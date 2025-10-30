#!/bin/bash

# Load Cloudflare API token from secrets file and export it
# Usage: source scripts/setup-cloudflare-env.sh

if [ -f "secrets/cloudflare.login" ]; then
    source secrets/cloudflare.login
    export CLOUDFLARE_API_TOKEN
    echo "✓ CLOUDFLARE_API_TOKEN exported"
    echo "Token: ${CLOUDFLARE_API_TOKEN:0:10}...${CLOUDFLARE_API_TOKEN: -10}"
else
    echo "✗ Error: secrets/cloudflare.login not found"
    exit 1
fi