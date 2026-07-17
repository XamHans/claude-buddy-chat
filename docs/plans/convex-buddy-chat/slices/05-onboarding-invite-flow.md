---
model: sonnet
effort: medium
why: Mostly glue following an established pattern — the original ntfy-based setup.js already solved the "idempotent local install + merge into settings.json" problem once. The token-minting invite step is new but small.
---
# 05 — Owner invite flow + onboarding overhaul + retire ntfy artifacts

## Prerequisites to start

- Read `../CONTRACT.md` section 3 — the config file this slice writes during
  onboarding must be byte-for-byte the same shape that 02/03/04 were already
  built and tested against (by hand, using the orchestration's minted test
  tokens), not a new format invented at this point.
- Slices 01–04 all merged and individually verified — this slice packages
  all of them, so it's the one place where the "parallel wave" (02/03/04)
  must have actually landed first.
- `gh` auth already in place for pushing to the GitHub repo (already
  confirmed working this session).
- A throwaway/fake `$HOME` for testing the installer without touching the
  real machine — same technique used for the original ntfy `setup.js`.

## What to build

Two halves of the same onboarding story, plus cleanup:

- **Owner side**: a local invite step (script or command) the user runs to
  mint a new friend's token via Convex's `mintToken` (slice 01), printing the
  token to hand over out-of-band — same distribution channel as the old ntfy
  topic slug (chat/email).
- **Friend side**: overhaul the `npx github:.../claude-buddy-chat <name>
  <token>` setup command so it seeds local config (Convex deployment URL,
  this person's token, initial room), wires the generic presence hook
  (slice 02), installs `tui.js` + its dependencies (Ink + React, one local
  `npm install`) and the revived skill (slice 04), and adds the `buddy` shell
  alias — idempotent on rerun, additive to any existing `settings.json`
  content, matching the original setup.js's merge behavior.
- **Retire**: remove the old ntfy-based `chat.js`, its bin entry, and the old
  ntfy-based skill content from the repo/package.

## Acceptance criteria

- [ ] Owner can mint a token for a new friend+room and it works against
      slice 01's functions.
- [ ] Running the updated `npx` setup against a fresh fake `$HOME` produces a
      fully working local environment: presence hook wired, `tui.js` +
      dependencies installed, skill present, `buddy` alias added — verified
      end-to-end, not just "files exist."
- [ ] Rerunning setup is idempotent — no duplicate hook entries, no duplicate
      alias lines.
- [ ] Existing unrelated `settings.json` content survives the merge untouched
      (same guarantee the original setup.js had).
- [ ] Old `chat.js`, its bin entry, and the ntfy-based skill content are gone
      from the repo.

## How to verify (pragmatic)

1. Mint a token for a fresh test persona via the owner invite step → works
   against slice 01's functions.
2. Run the updated `npx` setup against a fake `$HOME` (`HOME=$(mktemp -d)
   npx ...`, same trick used for the original ntfy `setup.js`) → hook wired,
   `tui.js` + `node_modules` (ink/react) present, skill present, `buddy`
   alias line added.
3. Re-run the exact same command against the same fake `$HOME` → no
   duplicate hook entries, no duplicate alias lines (idempotency check, same
   as done for the original `setup.js`).
4. Run against a fake `$HOME` pre-seeded with unrelated existing
   `settings.json` content → that content survives untouched after setup.
5. `grep -r` the repo for `chat.js` / `ntfy` → nothing left; `package.json`
   bin entries reflect only the current tools.

## Blocked by

- `01-convex-backend-foundation.md`
- `02-presence-hook-statusline.md`
- `03-tui-core-ink.md`
- `04-claude-skill.md`
