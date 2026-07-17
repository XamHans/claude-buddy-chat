---
model: sonnet
effort: medium
why: Same shape as the earlier ntfy-based `/buddy-chat` skill we already built once this session — only the transport (Convex HTTP API) and auth (per-friend token) change.
---
# 04 — Claude Code skill (Convex, token-authed)

## Prerequisites to start

- Read `../CONTRACT.md` first — it pins the exact HTTP calling convention
  (section 2) and local config file format (section 3) this slice must use.
  Slices 02 and 03 are built in parallel against the same conventions —
  divergence here is the main way this project fails to click together at
  merge time.
- Slice 01 deployed, including its curl-able path (same one slice 02 uses) —
  the skill shells out via curl, same as the old ntfy-based skill did.
- A local token already configured for testing (can reuse the one from
  slice 02's testing, or mint a fresh one).
- Only depends on slice 01 — does not need slice 02 or 03 to exist first, and
  can be built in parallel with either.

## What to build

Revive the `/buddy-chat` skill against Convex instead of ntfy: given
`$ARGUMENTS`, use the local person's token to call Convex directly (HTTP,
same functions as slice 01) to send a message and/or report recent history
and presence — the same "active, secondary path" the old skill offered, so
the user can ask Claude to check status or send a message without opening
the TUI.

Replace the old ntfy-based `SKILL.md` content; the skill's shape (read
`$ARGUMENTS`, send if non-empty, always show a short human-readable
transcript + presence line, never dump raw JSON) carries over from the prior
version.

## Acceptance criteria

- [ ] `/buddy-chat <message>` sends the message via Convex using the local
      token and shows a short transcript + presence, verified against real
      Convex data.
- [ ] `/buddy-chat` with no argument only shows status + history, doesn't
      send anything.
- [ ] Wrong/missing local token produces a clear failure, not a silent no-op.
- [ ] Old ntfy-based skill content is fully replaced, not left alongside.

## How to verify (pragmatic)

1. `/buddy-chat <message>` in a real Claude Code session → message shows up
   in Convex (`listMessages` via CLI or dashboard), visible from a second
   client too.
2. `/buddy-chat` with no argument → only reports status/history; message
   count in Convex is unchanged afterward.
3. Temporarily blank/corrupt the local token, run `/buddy-chat hello` →
   clear failure surfaces, no message silently created.
4. `grep -ri ntfy ~/.claude/skills/buddy-chat/` → nothing left from the old
   version.

## Blocked by

- `01-convex-backend-foundation.md`
- Independent of `02` and `03` — can be built in parallel with either.
