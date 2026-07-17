---
model: opus
effort: medium
why: Two new integrations at once (Ink/React for the terminal UI, Convex's realtime Node client for subscriptions) — unfamiliar territory for this project, but the scope is clearly bounded by the plan.
---
# 03 — TUI core (Ink) as a Convex client

## Prerequisites to start

- Read `../CONTRACT.md` first — it pins the local config file format
  (section 3) and local history cache format (section 4) this slice must
  use. Slices 02 and 04 are built in parallel against the same config file —
  divergence here is the main way this project fails to click together at
  merge time.
- Slice 01 deployed, reachable via the Convex JS client (this is the one
  consumer using it directly, not curl).
- At least two minted tokens for two distinct test personas/rooms, to
  actually exercise multi-room switching and live two-way delivery — not just
  one token talking to itself.
- `ink` + `react` installable via npm (needs network access once, same as any
  `npm install`).
- Only depends on slice 01 — does not need slice 02 or 04 to exist first, and
  can be built in parallel with them.

## What to build

The primary interface: a terminal app built with Ink (React for the
terminal — the same framework Claude Code itself is built with).

- Left pane: rooms/friends list from the local registry, live online/offline
  state via Convex reactive subscriptions (`listPresence`) — updates push in
  without manual polling.
- Right pane: chat log for the currently selected room, sourced from Convex
  (`listMessages`) merged with the local cache; bottom: input line that calls
  `sendMessage`.
- Every incoming/outgoing message is also appended to a local JSONL cache
  per room, so the TUI has something to render instantly on startup before
  the Convex connection is fully live, and briefly offline.
- Arrow keys / click to switch the selected room.
- A `:join` command (or equivalent) that adds a room to the local registry
  given a token the user has been handed.

## Acceptance criteria

- [ ] Launching the TUI shows the friends/rooms list with live status,
      sourced from real Convex data (not fixtures).
- [ ] Selecting a room shows its history (local cache renders immediately;
      Convex data reconciles once loaded) and lets you send messages that
      other real clients receive live.
- [ ] Works correctly with at least two rooms/memberships simultaneously —
      switching between them shows the right history and sends to the right
      room.
- [ ] `:join <token>` adds a room without restarting the TUI, and it appears
      in the list immediately.
- [ ] Local JSONL cache file exists per room and reflects what was sent/seen.

## How to verify (pragmatic)

1. Launch the TUI with one token → friends list renders from real Convex
   data (check it matches what `listPresence` returns directly).
2. Run two instances (or one instance + a raw test script) authenticated as
   two different memberships in the same room; send from one → confirm it
   appears live in the other, no restart, no manual refresh. Same style of
   two-directional test done earlier for the ntfy standalone chat client.
3. Kill and relaunch the TUI → local JSONL cache renders immediately, then
   Convex data reconciles once loaded.
4. `:join <token>` for a second room mid-session → appears in the list
   without restarting.
5. `cat` the local JSONL cache file directly → confirms messages were
   actually persisted, not just displayed.

## Blocked by

- `01-convex-backend-foundation.md`
- Independent of `02` and `04` — can be built in parallel with either.
