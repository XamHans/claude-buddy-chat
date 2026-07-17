#!/bin/sh
# Feeds mock stdin JSON to scripts/buddy-statusline.sh (same trick used for
# the original status line) and checks the printed "🟢 X/Y Freunde online"
# line against real Convex data. Also checks the background refresh isn't
# killed before it completes (the "kill-before-disown" bug class).
set -eu

cd "$(dirname "$0")/.."

fail() { echo "FAIL: $1" >&2; exit 1; }

CONVEX_URL="https://capable-platypus-33.eu-west-1.convex.cloud"

set_presence() {
  # $1 = personName ("test-alice"/"test-bob"), $2 = token, $3 = true/false
  curl -s -X POST "$CONVEX_URL/api/mutation" \
    -H 'Content-Type: application/json' \
    -d "{\"path\":\"presence:setPresence\",\"args\":{\"token\":\"$2\",\"online\":$3},\"format\":\"json\"}" \
    >/dev/null
}

ALICE_TOKEN="tok_712c6210f6d64f1a88609c6458cd6adc"
BOB_TOKEN="tok_b04a28d827e84f7b90961081f2155f9e"

export BUDDY_CONFIG="$(pwd)/tests/fixtures/config-alice.json"
export BUDDY_STATUS_CACHE="$(mktemp -u)/buddy-presence-cache-test-$$"
mkdir -p "$(dirname "$BUDDY_STATUS_CACHE")"
export BUDDY_CACHE_MAX_AGE=0 # always force a refresh for the test

cleanup() { rm -rf "$(dirname "$BUDDY_STATUS_CACHE")"; }
trap cleanup EXIT

echo "-- bob offline: expect 0/1 --"
set_presence test-bob "$BOB_TOKEN" false
rm -f "$BUDDY_STATUS_CACHE"
echo '{}' | sh scripts/buddy-statusline.sh >/dev/null # first call: no cache yet, kicks off background refresh
# wait for the background refresh to actually finish and write the cache
tries=0
while [ ! -f "$BUDDY_STATUS_CACHE" ] && [ "$tries" -lt 50 ]; do
  sleep 0.2
  tries=$((tries + 1))
done
[ -f "$BUDDY_STATUS_CACHE" ] || fail "background refresh never wrote the cache file (kill-before-disown?)"
out=$(echo '{}' | sh scripts/buddy-statusline.sh)
echo "$out"
echo "$out" | grep -q '🟢 0/1 Freunde online' || fail "expected '🟢 0/1 Freunde online', got: $out"

echo "-- bob online: expect 1/1 --"
set_presence test-bob "$BOB_TOKEN" true
rm -f "$BUDDY_STATUS_CACHE"
echo '{}' | sh scripts/buddy-statusline.sh >/dev/null
tries=0
while [ ! -f "$BUDDY_STATUS_CACHE" ] && [ "$tries" -lt 50 ]; do
  sleep 0.2
  tries=$((tries + 1))
done
out=$(echo '{}' | sh scripts/buddy-statusline.sh)
echo "$out"
echo "$out" | grep -q '🟢 1/1 Freunde online' || fail "expected '🟢 1/1 Freunde online', got: $out"

echo "-- background refresh survives parent script return --"
rm -f "$BUDDY_STATUS_CACHE"
before_mtime=0
echo '{}' | sh scripts/buddy-statusline.sh >/dev/null
# Immediately after the script returns, the cache write may not have landed
# yet if the refresh is truly backgrounded -- that's fine. What must NOT
# happen is the cache staying absent forever (i.e. the child got killed).
sleep 2
[ -f "$BUDDY_STATUS_CACHE" ] || fail "cache file missing 2s after script return -- background child likely killed"

echo "PASS: buddy-statusline.test.sh"
