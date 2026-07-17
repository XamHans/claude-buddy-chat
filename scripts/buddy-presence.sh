#!/bin/sh
# Sets online/offline presence for every membership in the local buddy-chat
# registry, by calling Convex's presence:setPresence mutation over plain
# HTTP (see docs/plans/convex-buddy-chat/CONTRACT.md sections 1-3).
#
# Usage: buddy-presence.sh online|offline
#
# Loops over every {room, token} pair in the local config file so joining
# more rooms later never requires touching this script or settings.json.
#
# Config file (default $HOME/.claude/buddy-chat/config.json, override with
# $BUDDY_CONFIG for testing):
#   {
#     "convexUrl": "https://....convex.cloud",
#     "personName": "Johannes",
#     "memberships": [{ "room": "jonas-room", "token": "tok_abc123" }]
#   }

state="${1:-}"
case "$state" in
  online) online_bool=true ;;
  offline) online_bool=false ;;
  *)
    echo "Usage: $0 online|offline" >&2
    exit 1
    ;;
esac

CONFIG_FILE="${BUDDY_CONFIG:-$HOME/.claude/buddy-chat/config.json}"

[ -f "$CONFIG_FILE" ] || exit 0

convex_url=$(jq -r '.convexUrl // empty' "$CONFIG_FILE" 2>/dev/null)
[ -n "$convex_url" ] || exit 0

jq -c '.memberships[]? // empty' "$CONFIG_FILE" 2>/dev/null | while IFS= read -r membership; do
  token=$(printf '%s' "$membership" | jq -r '.token // empty')
  [ -n "$token" ] || continue
  curl -s --max-time 5 -X POST "$convex_url/api/mutation" \
    -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg token "$token" --argjson online "$online_bool" \
      '{path:"presence:setPresence", args:{token:$token, online:$online}, format:"json"}')" \
    >/dev/null 2>&1
done
