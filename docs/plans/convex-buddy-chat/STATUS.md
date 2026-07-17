# convex-buddy-chat — status

See multiple friends' online status and chat with them via a terminal UI, backed by a self-owned Convex project instead of the public ntfy.sh relay.

All five slices built, verified, and merged into master (pushed to origin).
See `feedback.md` for lessons from the build (worktree isolation gotcha,
Convex HTTP error semantics, the destructive-action guardrail). Not yet done:
running the official onboarding flow on Johannes's own machine (so far only
verified in sandboxes) to get the `buddy` alias + `~/.claude/buddy-chat/tui/`
installed for real — his machine currently runs the slice 02/04 direct-install
state instead.

- [x] 01 — Convex backend foundation           (opus/high)
- [x] 02 — Presence hook + status line         (sonnet/medium)
- [x] 03 — TUI core (Ink) as a Convex client    (opus/medium)
- [x] 04 — Claude Code skill (Convex, token)    (sonnet/medium)
- [x] 05 — Onboarding overhaul + retire ntfy    (sonnet/medium)
