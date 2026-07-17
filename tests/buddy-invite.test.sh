#!/bin/sh
# Exercises scripts/buddy-invite.js (the owner invite step) against the
# *live* Convex deployment: mints a token for a fresh test persona via
# memberships:mintToken (real ADMIN_KEY from .env.local) and confirms the
# token actually works by calling presence:listPresence directly (not just
# "the script printed something that looks like a token").
set -eu

cd "$(dirname "$0")/.."

fail() { echo "FAIL: $1" >&2; exit 1; }

CONVEX_URL="https://capable-platypus-33.eu-west-1.convex.cloud"
PERSON="test-invite-$$"
ROOM="test-invite-room"

echo "-- minting a token for $PERSON in $ROOM via buddy-invite.js --"
output=$(node scripts/buddy-invite.js "$PERSON" "$ROOM")
echo "$output"

token=$(printf '%s\n' "$output" | grep -o 'tok_[a-f0-9]*' | head -1)
[ -n "$token" ] || fail "no token found in buddy-invite.js output"

echo "-- confirming the token actually works against listPresence --"
resp=$(curl -s -X POST "$CONVEX_URL/api/query" \
  -H 'Content-Type: application/json' \
  -d "{\"path\":\"presence:listPresence\",\"args\":{\"token\":\"$token\"},\"format\":\"json\"}")
echo "$resp"
status=$(printf '%s' "$resp" | jq -r '.status')
[ "$status" = "success" ] || fail "listPresence rejected the minted token: $resp"

found=$(printf '%s' "$resp" | jq -r --arg p "$PERSON" '[.value.memberships[] | select(.personName == $p)] | length')
[ "$found" -gt 0 ] || fail "minted persona $PERSON not found in listPresence results"

echo "-- rejects a bad admin key --"
if ADMIN_KEY="definitely-wrong" node scripts/buddy-invite.js "should-not-exist-$$" "$ROOM" 2>/dev/null; then
  fail "expected buddy-invite.js to fail with a bad ADMIN_KEY"
fi

echo "PASS: buddy-invite.test.sh"
