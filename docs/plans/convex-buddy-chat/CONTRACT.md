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
`npx convex env set ADMIN_KEY <secret>`; currently `***REMOVED-ROTATED-SEE-FEEDBACK-MD***`) — NOT
the literal `CONVEX_DEPLOY_KEY`, because the deploy key can't be read from
inside a Convex function. Slice 05's mint/onboarding step must pass this
`ADMIN_KEY` value as `adminKey`.

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
