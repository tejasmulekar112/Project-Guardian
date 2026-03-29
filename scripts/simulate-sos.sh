#!/usr/bin/env bash
set -euo pipefail

API_URL="${BACKEND_URL:-http://localhost:8000}"

echo "=== Simulating SOS Event ==="
echo "Target: $API_URL/sos/trigger"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/sos/trigger" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-001",
    "location": {
      "latitude": 28.6139,
      "longitude": 77.2090,
      "accuracyMeters": 10.0
    },
    "triggerType": "manual",
    "message": "Test SOS event from simulate-sos.sh"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | python -m json.tool 2>/dev/null || echo "$BODY"

echo ""
if [ "$HTTP_CODE" = "200" ]; then
  echo "SOS simulation successful."
else
  echo "SOS simulation failed (HTTP $HTTP_CODE)."
  exit 1
fi
