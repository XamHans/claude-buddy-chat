# Shared contracts — read before touching any slice

Slices 02, 03, and 04 are built **in parallel by three separate agents that
cannot see each other's work**. If each one invents its own local file format
or calling convention, they will not click together at merge time — this file
is the fix: every format/interface more than one slice touches is pinned here,
once, so nobody has to guess or improvise.

**Rule for every slice's agent: follow this file exactly. If something you
need isn't pinned here, that's a gap in the plan — flag it in your result
summary rather than inventing your own convention.**

## 1. Convex function names (fixed by slice 01, consumed by 02/03/04)

| Function | Path | Kind | Args | Returns |
|---|---|---|---|---|
| Mint a friend's token | `memberships:mintToken` | mutation | `{ adminKey, room, personName }` | `{ token }` |
| Set presence | `presence:setPresence` | mutation | `{ token, online }` | `{ ok: true }` |
| List presence | `presence:listPresence` | query | `{ token }` (returns every membership in the caller's rooms) | `{ memberships: [{ room, personName, online, lastSeen }] }` |
| Send message | `messages:sendMessage` | mutation | `{ token, room, text }` | `{ ok: true }` |
| List messages | `messages:listMessages` | query | `{ token, room, since? }` | `{ messages: [{ personName, text, time }] }` |

Auth is a plain argument (`token`), checked inside the function body against
the `memberships` table — **not** Convex's built-in identity/auth system.
`adminKey` for `mintToken` is a separate, higher-privilege owner secret, never
handed to friends. Implemented (slice 01) as a comparison against an
`ADMIN_KEY` Convex deployment environment variable (set with
`npx convex env set ADMIN_KEY <secret>`) — NOT the literal
`CONVEX_DEPLOY_KEY`, because the deploy key can't be read from inside a
Convex function. Slice 05's mint/onboarding step must pass this `ADMIN_KEY`
value as `adminKey`. The actual value lives only in the gitignored
`.env.local` — never write it into this or any other tracked file (an
earlier draft of this section did exactly that; the value was rotated after
the leak was caught, see `feedback.md`).

Timestamps (`time` on messages, `lastSeen` on presence) are **Unix seconds**,
matching the history-cache example in section 4 (e.g. `1784291334`).

If the actual implementation needs different arg names, update this table as
part of that change — don't let the table and the code drift.

## 2. Calling Convex over plain HTTP (used by slice 02's hook and slice 04's skill)

Convex's own generic HTTP API, confirmed current as of this plan (see
`docs.convex.dev/http-api`):

```
POST <CONVEX_URL>/api/mutation
POST <CONVEX_URL>/api/query
Content-Type: application/json

{"path": "presence:setPresence", "args": {"token": "...", "online": true}, "format": "json"}
```

`<CONVEX_URL>` is `https://capable-platypus-33.eu-west-1.convex.cloud` (from
the local config file, section 3 below — never hardcode it).

**Failure detection (corrected in slice 01 against the live deployment):**
Convex's generic `/api/query` and `/api/mutation` endpoints return **HTTP 200
even when the function throws** (bad token, etc.). The result envelope carries
the outcome in a `status` field:

```json
// success
{"status": "success", "value": { ... }}
// failure (e.g. bad token)
{"status": "error", "errorMessage": "...Uncaught Error: invalid token..."}
```

So callers MUST check `body.status === "success"` and read the result from
`body.value` — do **not** rely on the HTTP status code alone (an earlier draft
of this contract said failures come back non-2xx; that is not how these two
endpoints actually behave). A non-2xx only happens for transport/malformed
requests, not application errors.

## 3. Local config file (written by slice 05's onboarding, read by 02/03/04)

Path: `~/.claude/buddy-chat/config.json`

```json
{
  "convexUrl": "https://capable-platypus-33.eu-west-1.convex.cloud",
  "personName": "Johannes",
  "memberships": [
    { "room": "jonas-room", "token": "tok_abc123" }
  ]
}
```

- `memberships` is the local registry every slice loops over (02's presence
  hook posts to every entry; 03's TUI lists them as rooms; 04's skill uses
  whichever the user means, or the first one if unambiguous).
- Adding a room later (`:join` in the TUI, or a manual edit) means appending
  to this array — nothing here is per-slice-owned, all four slices read/write
  the same file.
- For slice 01/02/03/04 testing *before* slice 05 exists: write this file by
  hand with the test tokens minted in the orchestration script's "mint test
  tokens" step — same shape, same path, so slice 05 isn't inventing a format
  no one tested against.

## 4. Local chat history cache (slice 03 only)

Path: `~/.claude/buddy-chat/history/<room>.jsonl`, one JSON object per line:

```json
{"personName": "Jonas", "text": "hey", "time": 1784291334}
```

Append-only. Convex (`listMessages`) remains the source of truth; this file
is a read-instantly-on-startup cache, never the other way around.

## 5. What retires (slice 05)

- Old ntfy-based `chat.js`, its `package.json` bin entry, and the ntfy-based
  `SKILL.md` content — none of the formats above replace anything from the
  ntfy era; that trust model (topic slug) is fully gone, replaced by
  `memberships[].token`.

## 6. File locations, pinned after 02/03 built (gaps this file originally left open)

- **Presence/status-line scripts (slice 02):** repo-tracked at
  `scripts/buddy-presence.sh` and `scripts/buddy-statusline.sh`; installed by
  onboarding (slice 05) to `~/.claude/buddy-chat/presence.sh` and
  `~/.claude/buddy-chat/statusline.sh`. Already verified working at those
  install paths on the reference machine — don't rename.
- **TUI source (slice 03):** self-contained `tui/` subdirectory at the repo
  root, its own `package.json`/`node_modules` (Ink + React + the Convex
  client), entry point `tui/bin/buddy-chat-tui.js`. Onboarding (slice 05)
  installs this directory (or runs `npm install` inside it) under
  `~/.claude/buddy-chat/tui/`, and the `buddy` shell alias points at its
  entry point.
- **Claude Code skill (slice 04) — real gap, slice 05 must close it:** slice
  04's actual deliverable is verified and working, but only as a *global*
  file at `~/.claude/skills/buddy-chat/SKILL.md` on the machine it was built
  on — nothing about it is tracked in this repo (matching how the prior
  ntfy-era skill also lived outside the repo). That means, as written, a new
  friend's onboarding has no source to install *from*. Slice 05 must pull the
  already-verified content from `~/.claude/skills/buddy-chat/SKILL.md` into a
  repo-tracked template (e.g. `skill-template/SKILL.md`) and have onboarding
  write it out to each new machine's `~/.claude/skills/buddy-chat/SKILL.md` —
  don't rewrite the skill from scratch, the existing content is tested.
