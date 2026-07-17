# buddy-chat TUI (slice 03)

Terminal UI (Ink) that is a live Convex client for presence + chat.

- **Left pane**: rooms from the local registry, with live online/offline
  status via Convex reactive `listPresence` subscriptions.
- **Right pane**: chat log for the selected room — local JSONL cache renders
  instantly, then Convex `listMessages` reconciles.
- **Input line**: sends via `sendMessage`. Every message seen/sent is appended
  to the per-room JSONL cache.
- **↑/↓**: switch selected room. **`:join <token>`**: add a room mid-session
  (the room is discovered from the token via `listPresence`). **`:quit`**: exit.

Config and cache locations are pinned by `../docs/plans/convex-buddy-chat/CONTRACT.md`
(§3 config `~/.claude/buddy-chat/config.json`, §4 history
`~/.claude/buddy-chat/history/<room>.jsonl`). `BUDDY_CHAT_HOME` overrides the
base dir for testing only.

## Run

```
cd tui
npm install
npm start            # runs src/cli.jsx via tsx; needs a real terminal
# or: node bin/buddy-chat-tui.js
```

Requires `~/.claude/buddy-chat/config.json` (written by slice 05 onboarding,
or by hand per CONTRACT §3 for testing).

## Test

```
npm test             # node --test; includes live Convex integration tests
```
