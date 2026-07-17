#!/bin/sh
# End-to-end test of the overhauled onboarding command (setup.js), run
# against fake $HOME sandboxes so the real machine's ~/.claude is never
# touched (same technique the original setup.js test used).
#
# Mints real tokens against the live Convex deployment (via buddy-invite.js)
# so the onboarded config/hooks/tui are exercised against real data, not
# fixtures.
set -eu

cd "$(dirname "$0")/.."

fail() { echo "FAIL: $1" >&2; exit 1; }

CONVEX_URL="https://capable-platypus-33.eu-west-1.convex.cloud"

HOME1=$(mktemp -d)
HOME2=$(mktemp -d)
cleanup() { rm -rf "$HOME1" "$HOME2"; }
trap cleanup EXIT

query_online() {
  # $1 = token, $2 = personName (rooms are per-run-unique, but filter by
  # person too so a stale row from a previous run can never be picked up)
  curl -s -X POST "$CONVEX_URL/api/query" \
    -H 'Content-Type: application/json' \
    -d "{\"path\":\"presence:listPresence\",\"args\":{\"token\":\"$1\"},\"format\":\"json\"}" \
  | jq -r --arg p "$2" '[.value.memberships[] | select(.personName == $p)] | max_by(.lastSeen) | .online'
}

echo "== mint a fresh test persona for onboarding =="
PERSON="test-setup-$$"
ROOM="test-setup-room-$$"
mint_out=$(node scripts/buddy-invite.js "$PERSON" "$ROOM")
TOKEN=$(printf '%s\n' "$mint_out" | grep -o 'tok_[a-f0-9]*' | head -1)
[ -n "$TOKEN" ] || fail "could not mint a token for onboarding test"

echo "== 1. fresh install into a fake \$HOME =="
HOME="$HOME1" node setup.js "$PERSON" "$TOKEN" || fail "setup.js exited non-zero on fresh install"

CFG="$HOME1/.claude/buddy-chat/config.json"
[ -f "$CFG" ] || fail "config.json not written"
[ "$(jq -r '.convexUrl' "$CFG")" = "$CONVEX_URL" ] || fail "config.json convexUrl wrong"
[ "$(jq -r '.personName' "$CFG")" = "$PERSON" ] || fail "config.json personName wrong"
[ "$(jq -r --arg t "$TOKEN" '[.memberships[] | select(.token == $t)] | length' "$CFG")" = "1" ] \
  || fail "config.json membership for this token missing/duplicated"

PRESENCE_SH="$HOME1/.claude/buddy-chat/presence.sh"
STATUSLINE_SH="$HOME1/.claude/buddy-chat/statusline.sh"
[ -x "$PRESENCE_SH" ] || fail "presence.sh missing or not executable"
[ -x "$STATUSLINE_SH" ] || fail "statusline.sh missing or not executable"
diff -q "$PRESENCE_SH" scripts/buddy-presence.sh >/dev/null || fail "installed presence.sh differs from scripts/buddy-presence.sh"
diff -q "$STATUSLINE_SH" scripts/buddy-statusline.sh >/dev/null || fail "installed statusline.sh differs from scripts/buddy-statusline.sh"

SETTINGS="$HOME1/.claude/settings.json"
[ -f "$SETTINGS" ] || fail "settings.json not written"
start_count=$(jq --arg p "$PRESENCE_SH" '[.hooks.SessionStart[]?.hooks[]? | select(.command | contains($p)) | select(.command | contains("online"))] | length' "$SETTINGS")
end_count=$(jq --arg p "$PRESENCE_SH" '[.hooks.SessionEnd[]?.hooks[]? | select(.command | contains($p)) | select(.command | contains("offline"))] | length' "$SETTINGS")
[ "$start_count" = "1" ] || fail "expected exactly 1 SessionStart presence hook, got $start_count"
[ "$end_count" = "1" ] || fail "expected exactly 1 SessionEnd presence hook, got $end_count"

TUI_DEST="$HOME1/.claude/buddy-chat/tui"
TUI_BIN="$TUI_DEST/bin/buddy-chat-tui.js"
[ -f "$TUI_BIN" ] || fail "tui entry point not installed"
[ -d "$TUI_DEST/node_modules/ink" ] || fail "ink not installed in tui/node_modules"
[ -d "$TUI_DEST/node_modules/react" ] || fail "react not installed in tui/node_modules"

echo "-- confirming ink/react are actually loadable (not just present on disk) --"
( cd "$TUI_DEST" && node --import tsx -e "
  const ink = await import('ink');
  const react = await import('react');
  if (!ink.render || !react.default) throw new Error('unexpected shape');
  console.log('deps-ok');
" ) | grep -q 'deps-ok' || fail "ink/react could not actually be loaded from the installed tui/"

SKILL="$HOME1/.claude/skills/buddy-chat/SKILL.md"
[ -f "$SKILL" ] || fail "skill not installed"
diff -q "$SKILL" skill-template/SKILL.md >/dev/null || fail "installed skill differs from skill-template/SKILL.md"

ZSHRC="$HOME1/.zshrc"
[ -f "$ZSHRC" ] || fail "expected ~/.zshrc to be created for the buddy alias"
alias_count=$(grep -c "alias buddy=" "$ZSHRC")
[ "$alias_count" = "1" ] || fail "expected exactly 1 buddy alias line, got $alias_count"

echo "-- end-to-end: run the installed presence hook and confirm it flips real Convex state --"
# HOME must be the fake sandbox here too: presence.sh defaults to
# $HOME/.claude/buddy-chat/config.json when $BUDDY_CONFIG isn't set, and we
# want it reading $HOME1's installed config, never the real machine's.
HOME="$HOME1" sh "$PRESENCE_SH" online
[ "$(query_online "$TOKEN" "$PERSON")" = "true" ] || fail "presence hook 'online' did not flip Convex state"
HOME="$HOME1" sh "$PRESENCE_SH" offline
[ "$(query_online "$TOKEN" "$PERSON")" = "false" ] || fail "presence hook 'offline' did not flip Convex state"

echo "== 2. re-run the exact same command against the same \$HOME (idempotency) =="
HOME="$HOME1" node setup.js "$PERSON" "$TOKEN" || fail "setup.js exited non-zero on rerun"

start_count=$(jq --arg p "$PRESENCE_SH" '[.hooks.SessionStart[]?.hooks[]? | select(.command | contains($p)) | select(.command | contains("online"))] | length' "$SETTINGS")
end_count=$(jq --arg p "$PRESENCE_SH" '[.hooks.SessionEnd[]?.hooks[]? | select(.command | contains($p)) | select(.command | contains("offline"))] | length' "$SETTINGS")
[ "$start_count" = "1" ] || fail "rerun duplicated the SessionStart hook (got $start_count)"
[ "$end_count" = "1" ] || fail "rerun duplicated the SessionEnd hook (got $end_count)"

alias_count=$(grep -c "alias buddy=" "$ZSHRC")
[ "$alias_count" = "1" ] || fail "rerun duplicated the buddy alias line (got $alias_count)"

membership_count=$(jq -r --arg t "$TOKEN" '[.memberships[] | select(.token == $t)] | length' "$CFG")
[ "$membership_count" = "1" ] || fail "rerun duplicated the membership entry (got $membership_count)"

echo "== 3. fresh \$HOME pre-seeded with unrelated settings.json content =="
mkdir -p "$HOME2/.claude"
cat > "$HOME2/.claude/settings.json" <<'EOF'
{
  "unrelatedTopLevelKey": "keep-me-untouched",
  "hooks": {
    "Notification": [
      { "hooks": [ { "type": "command", "command": "echo unrelated-notification-hook" } ] }
    ]
  }
}
EOF

PERSON2="test-setup2-$$"
mint_out2=$(node scripts/buddy-invite.js "$PERSON2" "$ROOM")
TOKEN2=$(printf '%s\n' "$mint_out2" | grep -o 'tok_[a-f0-9]*' | head -1)
[ -n "$TOKEN2" ] || fail "could not mint a second token"

HOME="$HOME2" node setup.js "$PERSON2" "$TOKEN2" || fail "setup.js exited non-zero against pre-seeded settings.json"

SETTINGS2="$HOME2/.claude/settings.json"
[ "$(jq -r '.unrelatedTopLevelKey' "$SETTINGS2")" = "keep-me-untouched" ] \
  || fail "unrelated top-level settings.json key was lost"
[ "$(jq -r '.hooks.Notification[0].hooks[0].command' "$SETTINGS2")" = "echo unrelated-notification-hook" ] \
  || fail "unrelated Notification hook was lost"
[ "$(jq '.hooks.SessionStart | length' "$SETTINGS2")" = "1" ] \
  || fail "SessionStart hook was not added alongside unrelated content"

echo "PASS: setup-onboarding.test.sh"
