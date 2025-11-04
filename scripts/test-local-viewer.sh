#!/bin/bash

# Test the local viewer with new path-based URL pattern

echo "🧪 Testing Local Viewer - Path-Based URLs"
echo "=========================================="
echo ""

# Start local dev server in background
echo "Starting local dev server..."
cd cloudflare && npx wrangler dev --local --port 8788 > /tmp/wrangler-dev.log 2>&1 &
DEV_PID=$!
cd ..

# Wait for server to start
echo "Waiting for server to start..."
sleep 5

echo ""
echo "✅ Server started (PID: $DEV_PID)"
echo ""

# Test URLs
BASE_URL="http://localhost:8788"

echo "Testing new path-based URLs:"
echo ""

echo "1. Testing /design-system/v1.0.1/"
curl -I "$BASE_URL/design-system/v1.0.1/" 2>&1 | grep "HTTP\|Content-Type" || echo "Failed"
echo ""

echo "2. Testing /design-system/v1.0.0/"
curl -I "$BASE_URL/design-system/v1.0.0/" 2>&1 | grep "HTTP\|Content-Type" || echo "Failed"
echo ""

echo "3. Testing /design-system/v1.0.1/index.html"
curl -I "$BASE_URL/design-system/v1.0.1/index.html" 2>&1 | grep "HTTP\|Content-Type" || echo "Failed"
echo ""

echo "4. Testing project without version /my-project/"
curl -I "$BASE_URL/my-project/" 2>&1 | grep "HTTP\|Content-Type" || echo "Expected to fail if file doesn't exist"
echo ""

echo "=========================================="
echo "Local dev server is running at: $BASE_URL"
echo "PID: $DEV_PID"
echo ""
echo "To stop the server, run:"
echo "  kill $DEV_PID"
echo ""
echo "View logs:"
echo "  tail -f /tmp/wrangler-dev.log"
echo ""