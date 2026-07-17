#!/bin/sh
# Exercises scripts/buddy-presence.sh against the *live* Convex deployment
# using the test-alice membership, then confirms the flip via
# presence:listPresence directly (not just "curl returned 200").
set -eu

cd "$(dirname "$0")/.."

fail() { echo "FAIL: $1" >&2; exit 1; }

CONVEX_URL="https://capable-platypus-33.eu-west-1.convex.cloud"
TOKEN="tok_712c6210f6d64f1a88609c6458cd6adc"

query_online() {
  curl -s -X POST "$CONVEX_URL/api/query" \
    -H 'Content-Type: application/json' \
    -d "{\"path\":\"presence:listPresence\",\"args\":{\"token\":\"$TOKEN\"},\"format\":\"json\"}" \
  | jq -r --arg self "test-alice" \
    '[.value.memberships[] | select(.personName == $self)] | max_by(.lastSeen) | .online'
}

export BUDDY_CONFIG="$(pwd)/tests/fixtures/config-alice.json"

echo "-- setting online --"
sh scripts/buddy-presence.sh online
online_state=$(query_online)
[ "$online_state" = "true" ] || fail "expected online=true after 'online', got $online_state"

echo "-- setting offline --"
sh scripts/buddy-presence.sh offline
offline_state=$(query_online)
[ "$offline_state" = "false" ] || fail "expected online=false after 'offline', got $offline_state"

echo "-- rejects bad usage --"
if sh scripts/buddy-presence.sh bogus 2>/dev/null; then
  fail "expected non-zero exit for invalid state arg"
fi

echo "PASS: buddy-presence.test.sh"
