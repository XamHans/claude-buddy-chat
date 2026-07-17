---
model: opus
effort: high
why: Genuinely new territory for this project — schema design, a per-friend token auth model, and mutation/query design have no prior art to lean on here (the ntfy iteration had no backend code at all).
---
# 01 — Convex backend foundation

## Prerequisites to start

- This slice PRODUCES `../CONTRACT.md`'s function-name/args table (section
  1) — keep it in sync as you build; slices 02/03/04 are built in parallel
  against exactly what you write there, not against your code directly.
- A Convex account (free tier) — sign up at convex.dev if not already done;
  first `npx convex dev` triggers a browser login the user has to click
  through themselves.
- Node/npm available locally (already true — Claude Code requires it).
- Decide the functions must be callable from plain `curl` too, not just
  Convex's JS client — slices 02 and 04 call Convex from a shell script and a
  skill, neither of which can use the JS client. Either Convex's generic
  HTTP function-call API or custom `httpAction` routes will do; pick whichever
  is less code, but this slice isn't done until *something* curl-able exists.

## What to build

A Convex Cloud project with a schema and the core functions everything else
depends on: rooms (a friendship or small group), memberships (one row per
person per room, carrying that person's auth token), presence (latest
online/offline per membership), and messages (durable chat history per room).

Functions needed:
- `mintToken` — owner-only mutation that creates a membership (room, person
  name, a fresh token) and returns the token to hand to the friend.
- `setPresence` — mutation, authenticated by token, sets online/offline for
  the caller's membership.
- `listPresence` — query, returns online/offline + last-seen for every
  membership in a room (or across rooms the caller belongs to).
- `sendMessage` — mutation, authenticated by token, appends a message to a
  room.
- `listMessages` — query, returns a room's message history (bounded, most
  recent first or since a timestamp).

Auth is enforced inside the functions themselves (token must match a
membership row) — there's no separate auth layer to stand up.

This slice has no client yet. Verify it by calling these functions directly
(Convex CLI / a throwaway Node script), not through the TUI, hook, or skill —
those are later slices.

## Acceptance criteria

- [ ] Convex project is deployed and functions are callable.
- [ ] `mintToken` creates a membership and returns a usable token; a second
      call for a different person/room produces a distinct token.
- [ ] `setPresence` + `listPresence` round-trip correctly for a minted token —
      wrong/missing token is rejected.
- [ ] `sendMessage` + `listMessages` round-trip correctly, ordered by time.
- [ ] Calling any authenticated function with an invalid token fails clearly
      (no silent success, no data leak to the wrong room).

## How to verify (pragmatic)

All doable via `npx convex run <function> '<json args>'` — no client code
needed:

1. `npx convex dev` runs clean, dashboard reachable, schema deployed.
2. `mintToken` called twice with different names → two distinct tokens back.
3. `setPresence` with a minted token, then `listPresence` → reflects the
   change. Repeat with `offline`.
4. `sendMessage` with a minted token, then `listMessages` → message appears,
   correctly ordered.
5. Call `setPresence`/`sendMessage` with a made-up token → rejected with a
   clear error, not silent success, and nothing shows up in `listMessages`.
6. Confirm the curl-able path from the prerequisites note actually works:
   hit it with plain `curl`, not the CLI, at least once.

## Blocked by

None — can start immediately.
