# convex-buddy-chat — status

See multiple friends' online status and chat with them via a terminal UI, backed by a self-owned Convex project instead of the public ntfy.sh relay.

Dependency shape: 01 blocks everything. 02, 03, 04 only depend on 01 — not on
each other — so once 01 lands they can be built in parallel (separate
worktrees, or `/implement` run three times over if done sequentially). 05
needs all four finished, since it packages/distributes them together.

- [ ] 01 — Convex backend foundation           (opus/high)     👈 NEXT
- [ ] 02 — Presence hook + status line         (sonnet/medium)  ─┐
- [ ] 03 — TUI core (Ink) as a Convex client    (opus/medium)    ├─ parallel wave, both only blocked by 01
- [ ] 04 — Claude Code skill (Convex, token)    (sonnet/medium)  ─┘
- [ ] 05 — Onboarding overhaul + retire ntfy    (sonnet/medium)  (needs 01+02+03+04)
