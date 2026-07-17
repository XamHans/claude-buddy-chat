#!/bin/sh
# Buddy-chat status-line segment: prints "🟢 X/Y Freunde online" (X of Y
# other people, across every locally-registered room, currently online).
#
# Cached + background-refreshed so the status line never blocks on network
# latency: if the cache is older than BUDDY_CACHE_MAX_AGE seconds, a refresh
# is kicked off in the background (disowned, so it survives this script
# returning) and the *previous* cached line is printed immediately.
#
# Reads stdin (the status-line JSON payload) but doesn't need any field from
# it today; consumed anyway so this composes with the rest of a
# statusLine command script that pipes the same stdin to multiple segments.
#
# Config file: see buddy-presence.sh header. Override paths for testing via
# $BUDDY_CONFIG / $BUDDY_STATUS_CACHE / $BUDDY_CACHE_MAX_AGE.

cat >/dev/null # drain stdin, unused

CONFIG_FILE="${BUDDY_CONFIG:-$HOME/.claude/buddy-chat/config.json}"
CACHE_FILE="${BUDDY_STATUS_CACHE:-$HOME/.claude/buddy-chat/presence-cache}"
CACHE_MAX_AGE="${BUDDY_CACHE_MAX_AGE:-15}"

[ -f "$CONFIG_FILE" ] || exit 0

cache_age() {
  if [ ! -f "$CACHE_FILE" ]; then
    echo 999999
    return
  fi
  now=$(date +%s)
  mtime=$(stat -f %m "$CACHE_FILE" 2>/dev/null || stat -c %Y "$CACHE_FILE" 2>/dev/null || echo 0)
  echo $(( now - mtime ))
}

if [ "$(cache_age)" -gt "$CACHE_MAX_AGE" ]; then
  (
    convex_url=$(jq -r '.convexUrl // empty' "$CONFIG_FILE" 2>/dev/null)
    person=$(jq -r '.personName // empty' "$CONFIG_FILE" 2>/dev/null)
    if [ -n "$convex_url" ]; then
      resp_file=$(mktemp)
      jq -c '.memberships[]? // empty' "$CONFIG_FILE" 2>/dev/null | while IFS= read -r membership; do
        token=$(printf '%s' "$membership" | jq -r '.token // empty')
        [ -n "$token" ] || continue
        curl -s --max-time 3 -X POST "$convex_url/api/query" \
          -H 'Content-Type: application/json' \
          -d "$(jq -nc --arg token "$token" '{path:"presence:listPresence", args:{token:$token}, format:"json"}')" \
          2>/dev/null
        printf '\n'
      done > "$resp_file"

      counts=$(jq -s -r --arg self "$person" '
        [ .[] | select(.status == "success") | .value.memberships[]? ]
        | group_by(.room + "|" + .personName)
        | map(max_by(.lastSeen))
        | map(select(.personName != $self))
        | (map(select(.online == true)) | length) as $on
        | length as $tot
        | "\($on) \($tot)"
      ' "$resp_file" 2>/dev/null)
      rm -f "$resp_file"

      if [ -n "$counts" ]; then
        printf '%s\n' "$counts" > "$CACHE_FILE.tmp" && mv "$CACHE_FILE.tmp" "$CACHE_FILE"
      fi
    fi
  ) >/dev/null 2>&1 &
  disown 2>/dev/null || true
fi

if [ -f "$CACHE_FILE" ]; then
  read -r online total < "$CACHE_FILE"
  if [ -n "$total" ]; then
    printf '🟢 %s/%s Freunde online\n' "${online:-0}" "$total"
  fi
fi
