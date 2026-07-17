# Buddy-Chat: Multi-Friend Presence + TUI (Convex backend)

## Problem

The user wants to see online/offline status for multiple friends/groups at once
and chat with them easily, primarily through a dedicated terminal UI —
independent of Claude Code — plus a light passive glance from inside Claude
Code's status line, and an optional active path where Claude Code itself can
act on the user's behalf.

## History of this decision (why Convex, not ntfy/self-hosted)

An earlier iteration used ntfy.sh (free public pub-sub relay) and shipped
working presence hooks + a standalone chat CLI for one friend. This plan
supersedes that with a proper backend, after evaluating:

- **Self-hosting on the user's Mac Mini** (ntfy self-hosted, a custom
  Node+SQLite server, self-hosted Convex, or MQTT/Mosquitto) — rejected. All of
  these leave an unsolved reachability problem (home network NAT / dynamic IP;
  a friend can't just connect in), which would need Tailscale/Cloudflare Tunnel
  regardless of backend choice. Self-hosted Convex specifically also binds to
  `127.0.0.1` by default and needs its own reverse proxy to be reachable at all.
- **Convex Cloud** (managed, hosted by Convex) — chosen. Free tier (1M function
  calls/month, 0.5GB storage, full platform including reactive subscriptions
  and auth) comfortably covers a 2-3 person hobby chat, reactive subscriptions
  are billed on data changes, not polling, so cost stays low. Using the public
  cloud URL means friends connect directly — no tunnel, no port-forwarding, no
  Mac Mini uptime dependency.

The trade-off accepted: data lives on Convex's infrastructure, not the user's
own hardware. This was a conscious choice, not an oversight.

## Goals

- See online/offline status for all friends/rooms you've joined, in one place.
- Chat with any of them from a real terminal UI (friends list + chat pane).
- Chat history persists durably (Convex is the source of truth; each client
  also keeps a local cache).
- Claude Code gets a secondary, *active* path (a skill, not a full MCP-server
  deployment) to check status / send messages on the user's behalf, alongside
  the existing passive status-line glance.
- Real per-friend access control (a token per person), not ntfy's
  shared-secret-by-obscurity model.
- Adding a new friend/group should not require editing `settings.json` by hand.
- Keep daily TUI startup to one short command.

## Non-goals

- Not self-hosted — explicitly rejected, see history above.
- No group-management UI beyond what's needed for a handful of friends (no
  admin dashboard beyond Convex's own).
- No mobile app.

## Architecture

- **Backend**: Convex Cloud project owned by the user. Schema covers:
  - `rooms` — one row per friendship/group (a room has a name/label).
  - `memberships` — `{ room, personName, token }`, one row per person per room;
    the token is how that person's client/skill authenticates.
  - `presence` — latest online/offline state per membership.
  - `messages` — durable chat history per room.
- **Token issuance**: the user (owner, holds the Convex admin/deploy access)
  is the only one who can mint a new friend's token — invoked locally (a
  script calling a Convex mutation) during onboarding. The minted token is
  handed to the friend out-of-band (same channel as the old topic slug — e.g.
  chat/email), the same way the ntfy slug was shared before.
- **TUI** (`~/.claude/buddy-chat/tui.js`, built with **Ink** — a React-based
  terminal UI framework, the same one Claude Code and Gemini CLI are built
  with; plain Node/npm, no extra runtime): the primary interface.
  - Left pane: rooms/friends list, live online/offline via Convex reactive
    subscriptions.
  - Right pane: chat log for the selected room; bottom: input line.
  - Every incoming/outgoing message is also appended to a local JSONL cache
    per room (`~/.claude/buddy-chat/history/<room>.jsonl`) so the TUI loads
    instantly on start and has something to show briefly offline. Convex
    remains the durable source of truth.
  - `:join` (or equivalent) adds a room the user has been given a token for.
- **Presence**: `SessionStart`/`SessionEnd` hooks call a small script that
  invokes a Convex mutation (using the local person's token) to set
  online/offline for every room in the local registry — same "loop over all
  my rooms" shape as the earlier ntfy design, just calling Convex instead of
  posting to ntfy topics.
- **Status line**: unchanged in spirit — a cached/async background-refreshed
  segment showing `🟢 X/Y Freunde online`, now reading from Convex (via a
  simple authenticated query/HTTP call) instead of ntfy's JSON endpoint.
- **Claude Code skill** (revived, replaces the old ntfy-based `/buddy-chat`):
  calls Convex directly using the local person's token — lets the user ask
  Claude in natural language to check status or send a message, without
  opening the TUI. This is deliberately a skill (prompt + API calls), not a
  standalone deployed MCP server — less to build and operate for the same
  outcome.

## What gets retired

- The ntfy.sh-based `/buddy-chat` skill and `chat.js` (superseded by the
  Convex-based skill and `tui.js` respectively).
- The two old hardcoded ntfy `SessionStart`/`SessionEnd` hook entries.
- The ntfy topic-slug trust model (replaced by per-friend Convex tokens).

## Setup flow

**Owner (first-time, one-time):** create the Convex project, deploy the
schema/functions.

**Inviting a new friend:** owner runs a local invite step that calls a Convex
mutation to mint `{room, personName, token}`, then shares the token with the
friend out-of-band.

**Friend (onboarding, one command):**
```
npx github:XamHans/claude-buddy-chat <name> <token>
```
This seeds local config (Convex deployment URL + this person's token +
initial room), wires the generic presence hook, installs `tui.js` + its
dependencies (`ink` + React, via a local `npm install` once) + the revived
Claude Code skill, and adds a `buddy` shell alias.

Joining further rooms later happens by receiving another token from whoever
owns that room and adding it locally (no npx re-run required).

## Explicitly out of scope for this change

- Updating the existing Gmail draft to Jonas — the user will handle that
  separately.
