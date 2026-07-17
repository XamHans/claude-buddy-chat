---
model: sonnet
effort: medium
why: Same cache/background-refresh/disown shape already built and debugged twice this session against ntfy — the pattern is known. What's new is calling Convex's HTTP API with a token from POSIX sh instead of curl-posting to ntfy, which deserves care but isn't unfamiliar territory.
---
# 02 — Presence hook + status line against Convex

## Prerequisites to start

- Read `../CONTRACT.md` first — it pins the exact HTTP calling convention
  (section 2) and local config file format (section 3) this slice must use.
  Slices 03 and 04 are built in parallel against the same file — divergence
  here is the main way this project fails to click together at merge time.
- Slice 01 deployed, including its curl-able path (not just the JS-client
  path) — this slice's hook and status line are plain `sh` + `curl` + `jq`,
  same tools already used for the ntfy version.
- At least one real minted token to test with (the user's own membership).
- A local registry file format decided (room + token pairs) — reuse the same
  shape/location the ntfy iteration used for topics, just swap slug→token.

## What to build

Replace the ntfy-based presence hooks and status-line segment with versions
that talk to the Convex functions from slice 01.

- A generic presence script, invoked by `SessionStart`/`SessionEnd`, that
  reads the local room registry (room + token per membership) and calls
  `setPresence` for every entry in a loop — so joining more rooms later never
  requires touching `settings.json` again.
- The status-line segment keeps its existing cached/async shape (background
  refresh, `disown`, short TTL) but now fetches from `listPresence` across all
  local memberships and renders the same aggregate `🟢 X/Y Freunde online`
  format instead of a single buddy's name.
- Remove the two old hardcoded ntfy `SessionStart`/`SessionEnd` hook entries
  from `settings.json`.

## Acceptance criteria

- [ ] Restarting Claude Code calls `setPresence(online)` for every room in the
      local registry; ending the session calls `setPresence(offline)`.
- [ ] Status line shows the correct `🟢 X/Y` count, verified against real
      Convex data (not mocked), refreshing on the existing cache cadence
      without blocking the status line on network latency.
- [ ] The background refresh actually completes (watch for the same
      kill-before-disown class of bug hit earlier with ntfy).
- [ ] Old hardcoded ntfy hook entries are gone from `settings.json`; no
      duplicate or dangling entries remain.

## How to verify (pragmatic)

1. Run the presence script by hand with `online`, then `offline` — check via
   `npx convex run listPresence` (or the Convex dashboard) that state actually
   flips, not just that curl returned 200.
2. Restart a real Claude Code session → confirm `SessionStart` posted online;
   exit it → confirm `SessionEnd` posted offline. Check Convex, not just the
   local cache.
3. Feed the status-line script mock stdin JSON by hand (same trick used for
   the ntfy version: `echo '{...}' | sh statusline-command.sh`) → confirm the
   right `🟢 X/Y` count prints.
4. Repeat the earlier disown/background-kill check: launch the background
   refresh, confirm the child process is still alive and completes after the
   parent script returns — this exact class of bug bit the ntfy version once.
5. `grep` `settings.json` for the old ntfy hook commands → gone, no
   duplicates, no dangling entries.

## Blocked by

- `01-convex-backend-foundation.md`
