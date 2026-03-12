#!/bin/bash
# Final Connectivity Test Script
# Tests the /api/health/db endpoint and verifies Supabase connection

set -e

echo "=========================================="
echo "Supabase Connectivity Final Verification"
echo "=========================================="
echo ""

# Expected project reference
EXPECTED_PROJECT_REF="vpwnjibcrqujclqalkgy"

# Test URL (adjust if needed)
TEST_URL="${1:-http://localhost:3000/api/health/db}"

echo "Testing endpoint: $TEST_URL"
echo ""

# Make the request
echo "Sending request..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$TEST_URL")

# Extract HTTP status
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "HTTP Status: $HTTP_STATUS"
echo ""

# Check if successful
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ HTTP 200 - Success!"
    echo ""
    echo "Response body:"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    echo ""
    
    # Extract projectRef from response
    PROJECT_REF=$(echo "$BODY" | jq -r '.projectRef' 2>/dev/null || echo "")
    OK_STATUS=$(echo "$BODY" | jq -r '.ok' 2>/dev/null || echo "")
    
    if [ "$OK_STATUS" = "true" ]; then
        echo "✅ Connection status: OK"
        
        if [ "$PROJECT_REF" = "$EXPECTED_PROJECT_REF" ]; then
            echo "✅ Project reference matches: $PROJECT_REF"
            echo ""
            echo "=========================================="
            echo "✅ PASS: Connected to $PROJECT_REF"
            echo "=========================================="
            exit 0
        else
            echo "❌ Project reference mismatch!"
            echo "   Expected: $EXPECTED_PROJECT_REF"
            echo "   Got: $PROJECT_REF"
            exit 1
        fi
    else
        echo "❌ Connection status: FAILED"
        echo "   Check the error message in the response above"
        exit 1
    fi
    
elif [ "$HTTP_STATUS" = "503" ]; then
    echo "⚠️  HTTP 503 - Service Unavailable"
    echo ""
    echo "Response body:"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    echo ""
    echo "This usually means:"
    echo "1. The _connection_canary table doesn't exist"
    echo "2. Run the SQL migration: migrations/95-add-connection-canary-table.sql"
    echo "3. Or the database is unreachable"
    exit 1
    
elif [ "$HTTP_STATUS" = "500" ]; then
    echo "❌ HTTP 500 - Internal Server Error"
    echo ""
    echo "Response body:"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    echo ""
    echo "This usually means environment variables are missing."
    echo "Check your .env.local file."
    exit 1
    
else
    echo "❌ Unexpected HTTP status: $HTTP_STATUS"
    echo ""
    echo "Response body:"
    echo "$BODY"
    exit 1
fi
