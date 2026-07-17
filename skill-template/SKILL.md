---
name: buddy-chat
description: Send a chat message to your Claude-Code buddy or check recent messages and whether they're currently online. Bridges Claude Code sessions over a shared Convex Cloud deployment. Only invoke manually with /buddy-chat.
disable-model-invocation: true
allowed-tools: Bash(curl *) Bash(node *) Write(*)
---

# Buddy chat over Convex

Presence + chat bridge between Claude Code buddies, backed by a shared Convex
Cloud deployment (not a public relay — every call is authenticated with a
per-friend token). Nothing to install — plain HTTPS.

Local config: `~/.claude/buddy-chat/config.json`

```json
{
  "convexUrl": "https://...convex.cloud",
  "personName": "yourname",
  "memberships": [ { "room": "some-room", "token": "tok_..." } ]
}
```

If this file is missing, unreadable, or has an empty `memberships` array,
that is a clear failure: tell the user their buddy-chat isn't set up (no
local token to authenticate with) and stop — don't guess, don't fall back to
anything else, don't report empty history as if it were real.

The user's message, if any, is: $ARGUMENTS

## What to do

1. Read `~/.claude/buddy-chat/config.json`. Pick which membership (room +
   token) to use: if `$ARGUMENTS` names one of the rooms in `memberships`,
   use that one; otherwise use `memberships[0]`. Call this room's token
   `TOKEN` and its room `ROOM` below.

2. If `$ARGUMENTS` is non-empty, send it as a message:
   - First write the exact raw text of `$ARGUMENTS` to a scratch file with
     the Write tool (e.g. under the scratchpad directory). Never splice the
     raw message text directly into a shell command or hand-built JSON
     string — it may contain quotes/backticks/`$(...)`/newlines that would
     break the request or, worse, execute as shell.
   - Turn it into a safely-escaped JSON request body with `node` (this
     handles all quoting for you — do not hand-escape):
     ```
     node -e '
       const fs = require("fs");
       const [scratchfile, payloadfile, token, room] = process.argv.slice(1);
       const text = fs.readFileSync(scratchfile, "utf8");
       fs.writeFileSync(payloadfile, JSON.stringify({
         path: "messages:sendMessage",
         args: { token, room, text },
         format: "json",
       }));
     ' <scratchfile> <payloadfile> "$TOKEN" "$ROOM"
     ```
   - POST it:
     `curl -s -X POST -H "Content-Type: application/json" --data @<payloadfile> "$CONVEX_URL/api/mutation"`
   - Parse the JSON response. It is HTTP 200 either way — the outcome is in
     the body: `{"status":"success","value":{"ok":true}}` or
     `{"status":"error","errorMessage":"..."}`. If `status` is `"error"`
     (e.g. invalid token), that's a clear failure: report the error message
     plainly and stop — do not claim the message was sent, and do not
     silently continue to step 3 as if nothing happened.

3. Always fetch recent history and presence (this step runs even if nothing
   was sent, and even right after a send):
   - History: POST `{"path":"messages:listMessages","args":{"token":"$TOKEN","room":"$ROOM"},"format":"json"}`
     to `$CONVEX_URL/api/query`.
   - Presence: POST `{"path":"presence:listPresence","args":{"token":"$TOKEN"},"format":"json"}`
     to `$CONVEX_URL/api/query`.
   - Same status check as above — if either call comes back
     `"status":"error"` (e.g. the token itself is bad), report that failure
     clearly instead of showing an empty/stale transcript as if it were
     current data.

4. Report back as a short, human-readable summary — never dump raw JSON:
   - If a message was sent, say so in one line.
   - A chat transcript (oldest to newest): sender + local time (convert the
     Unix-seconds `time` field) + text. If there are no messages, say so
     plainly.
   - One line per membership on `listPresence`'s `memberships`: who's
     online/offline and since when (`lastSeen`, Unix seconds).
