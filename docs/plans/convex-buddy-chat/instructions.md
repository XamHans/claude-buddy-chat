# convex-buddy-chat — orchestration instructions

**Status: build complete.** All five slices shipped, merged into `master`,
and pushed — see `STATUS.md`. This file (and its embedded script) is now a
historical record of *how* it was built, kept for reference if the plan is
ever extended (a slice 06+) or the build needs redoing from scratch. For
day-to-day usage, see the repo's `README.md`; for what went wrong and got
fixed along the way, see `feedback.md`.

Single entry point to build this plan end-to-end. Read this whole file first —
it carries the full context so nothing needs to be re-derived from `plan.md`
or the individual slice files.

## Context (short version)

Multi-friend presence + chat, Convex Cloud backend (not self-hosted — see
`plan.md` "History of this decision" for why), Ink-based terminal UI, a
revived Claude Code skill, token-based auth per friend. Five slices in
`slices/`, dependency shape:

```
01 (foundation)
 └─▶ 02, 03, 04   ← independent of each other, parallel wave
      └─▶ 05 (needs all four)
```

**`CONTRACT.md`** (same folder) pins every shared file format and calling
convention that crosses slice boundaries — required reading for 01 (produces
it) and 02/03/04/05 (must follow it exactly, since three of them are built by
agents that can't see each other's work).

## One-time human prerequisite — cannot be automated

- [x] Convex account + project created (`capable-platypus-33`, dev
      deployment, `dev/johannes`, region eu-west-1). Done — the account owner
      completed the browser OAuth login themselves.

Connection details (not secret — just endpoints):
- Cloud URL: `https://capable-platypus-33.eu-west-1.convex.cloud`
- HTTP Actions URL: `https://capable-platypus-33.eu-west-1.convex.site`

The actual credential (a deploy key named "claude", never-expiring) lives
**only** in `.env.local` at the repo root, which is gitignored (`.gitignore`
excludes `.env*`, verified with `git check-ignore` before anything was
written). It is never referenced by value in this file or any tracked file —
slice 01's agent should read it from `.env.local` at runtime, not have it
inlined into a prompt or committed anywhere.

Everything else (GitHub push access, Node/npm, `gh` auth) is already
confirmed working in this project.

## What the manager does when invoked

1. **Confirm inputs once, upfront** — checks the human prerequisite above is
   actually done (asks once if not, then stops and waits — does not proceed
   on a guess). Does not re-ask about anything else mid-run.
2. **Foundation** — runs slice 01 to completion, then runs every check in its
   own "How to verify" section itself. Only proceeds past this point if all
   of them pass.
3. **Mint test tokens** — a worktree is a fresh checkout of tracked files
   only; `.env.local` (gitignored) does **not** appear there automatically,
   and the parallel-wave slices don't need the admin deploy key anyway, only
   ordinary membership tokens. So: in the main tree (where `.env.local` is
   present), mint 2-3 throwaway test memberships (e.g. `test-alice`,
   `test-bob`) via slice 01's `mintToken`, and carry *those* tokens — not the
   admin key — into the parallel wave's prompts.
4. **Parallel wave** — runs slices 02, 03, 04 concurrently, each in an
   isolated git worktree (they touch different parts of the tree but share a
   repo, so isolation avoids collisions). Each is test-first against its own
   slice file, each verifies itself against its own "How to verify" section,
   using the test tokens from the previous step (each agent writes them into
   its own worktree's local config — nothing here needs the admin key).
5. **Merge back** — merges the three worktree branches into the plan's
   feature branch one at a time (sequential merges avoid a three-way
   conflict), re-running each slice's verification once merged.
6. **Packaging** — runs slice 05 against the now-consolidated tree.
7. **Report** — updates `STATUS.md`, returns one consolidated summary: what
   shipped, what was verified, what (if anything) failed and where it stopped.

Status updates in between are short one-line pings (`log()` — "slice 01
verified, starting parallel wave", "02/03 done, 04 still running", etc.), not
a play-by-play of every file touched. The full detail lives in the workflow
transcript/journal if it's ever needed.

If any slice's verification fails, the manager stops there rather than
plowing ahead — it reports what failed and where, and does not attempt 05
with an unverified foundation underneath it.

## Orchestration script (paste into Workflow when ready to run)

```js
export const meta = {
  name: 'convex-buddy-chat-build',
  description: 'Build the convex-buddy-chat plan end-to-end: foundation, parallel wave, merge, packaging',
  phases: [
    { title: 'Foundation', detail: 'Slice 01 - Convex backend', model: 'opus' },
    { title: 'Parallel wave', detail: 'Slices 02, 03, 04 concurrently' },
    { title: 'Merge', detail: 'Sequentially merge the three worktrees back', model: 'opus' },
    { title: 'Packaging', detail: 'Slice 05 - onboarding + retire ntfy' },
  ],
}

const REPO_DIR = '/private/tmp/claude-501/-Users-jhayer/87a6f12e-92e6-4583-b2f8-fff68ef81697/scratchpad/claude-buddy-chat'
const PLAN_DIR = `${REPO_DIR}/docs/plans/convex-buddy-chat`

// Frozen, byte-for-byte identical to the first run's prompt — slice 01
// already completed and verified; keeping this untouched lets a resume hit
// the cache instead of re-deploying/re-touching Convex for no reason.
const PROJECT_CONTEXT_V1 = `Your working directory / repo for this task is
${REPO_DIR} — cd there first, everything below is relative to it. You're
building one piece of "convex-buddy-chat": a
system where multiple friends see each other's online/offline status and
chat, mainly through a terminal UI (Ink) — independent of Claude Code, plus a
light passive status-line glance and an optional active Claude-Code skill.
It's backed by a Convex Cloud project the user owns (deliberately not
self-hosted, and not the old ntfy.sh relay this project used to use — read
${PLAN_DIR}/plan.md's "History of this decision" if you want the why). Auth
is a per-friend token checked as a plain function argument, not Convex's
built-in identity system.

Before writing any code: read ${PLAN_DIR}/CONTRACT.md in full. It pins the
exact Convex function names/args, the HTTP calling convention, the local
config file format, and the local history cache format — every one of these
is shared with other slices being built at the same time by other agents who
can't see your work, and you can't see theirs. Follow CONTRACT.md exactly,
even where you'd normally make a different judgment call. If you need
something that isn't pinned there, say so in your result summary instead of
inventing your own convention — a mismatch here is the main way this project
fails to click together at the end.`

// Everything that hasn't run yet uses this — adds the guardrail learned the
// hard way in feedback.md item 1, and drops reliance on the Workflow tool's
// isolation:'worktree' flag (feedback.md item 2: it needs the *session's*
// cwd to be a git repo, not just the target repo, so it always failed here).
const PROJECT_CONTEXT = `${PROJECT_CONTEXT_V1}

Guardrail (learned the hard way on the first run — see ${PLAN_DIR}/feedback.md
item 1): if anything you're about to deploy/modify/clear would touch
pre-existing data or state you didn't create — in Convex, in git, anywhere —
STOP and report it in your result summary instead of clearing or overwriting
it, even if that's the only way to make your own task succeed.

Isolation note (feedback.md item 2): don't rely on any tool-level worktree
isolation. If your task needs an isolated workspace, create it yourself:
\`git -C ${REPO_DIR} worktree add <sibling-path> -b <branch-name>\`, then cd
into that path and do all your work there. Commit when done; don't push or
merge yourself — a separate step handles merging.`

const SLICE_RESULT = {
  type: 'object',
  properties: {
    allPassed: { type: 'boolean' },
    summary: { type: 'string' },
    failedChecks: { type: 'array', items: { type: 'string' } },
  },
  required: ['allPassed', 'summary'],
}

const TOKENS_RESULT = {
  type: 'object',
  properties: {
    tokens: {
      type: 'array',
      items: {
        type: 'object',
        properties: { personName: { type: 'string' }, room: { type: 'string' }, token: { type: 'string' } },
        required: ['personName', 'room', 'token'],
      },
    },
  },
  required: ['tokens'],
}

function sliceTask(file, extraContext, ctx = PROJECT_CONTEXT) {
  return `${ctx}

Your specific task: implement ${PLAN_DIR}/slices/${file} test-first. Read the
whole slice file (Prerequisites, What to build, Acceptance criteria, How to
verify) after CONTRACT.md. Build it, then run every step under "How to
verify" yourself and confirm each one actually passes before returning —
don't just assert it works. Report allPassed=false with the specific failing
checks if anything doesn't pass; never report allPassed=true on a guess.${extraContext ? `\n\n${extraContext}` : ''}`
}

function worktreeNote(num, slug) {
  return `Isolated workspace for this slice: create it yourself with
\`git -C ${REPO_DIR} worktree add ${REPO_DIR}-wt-${num} -b slice/${num}-${slug}\`,
then cd into ${REPO_DIR}-wt-${num} and do all your work there. Commit there
when done; don't push or merge — the merge step handles that afterward.`
}

phase('Foundation')
log('Building slice 01 (Convex backend foundation)...')
// Uses PROJECT_CONTEXT_V1 (frozen) so this call's (prompt, opts) match the
// first run exactly and a resume hits cache instead of re-deploying.
const slice01 = await agent(sliceTask('01-convex-backend-foundation.md', undefined, PROJECT_CONTEXT_V1), {
  label: 'slice-01', model: 'opus', effort: 'high', schema: SLICE_RESULT,
})
if (!slice01?.allPassed) {
  log(`Slice 01 did not fully verify: ${slice01?.summary ?? 'no result'}. Stopping before the parallel wave.`)
  return { status: 'blocked-at-foundation', slice01 }
}

log('Minting throwaway test memberships (not the admin key) for the parallel wave to use...')
const minted = await agent(
  `${PROJECT_CONTEXT}

Your specific task: using the admin deploy key in .env.local (main tree, do
not print its value or copy it anywhere else), call the mintToken mutation
(per CONTRACT.md's exact args) twice to create two throwaway test
memberships in the same room: personName "test-alice" and "test-bob".
Return their room name and tokens.`,
  { label: 'mint-test-tokens', model: 'sonnet', effort: 'low', schema: TOKENS_RESULT }
)
const tokenContext = `Test memberships already minted for you to use — do not
mint your own, do not use the admin key:\n${JSON.stringify(minted?.tokens ?? [], null, 2)}\n
Convex Cloud URL: ${'`'}https://capable-platypus-33.eu-west-1.convex.cloud${'`'}
HTTP Actions URL: ${'`'}https://capable-platypus-33.eu-west-1.convex.site${'`'}
Write whichever of these you need into your own worktree's local
(gitignored) config — you are in an isolated worktree with no access to the
main tree's .env.local.`

phase('Parallel wave')
log('Slice 01 verified, test tokens minted. Starting 02, 03, 04 in parallel, each in its own self-managed worktree...')
const [slice02, slice03, slice04] = await parallel([
  () => agent(sliceTask('02-presence-hook-statusline.md', `${tokenContext}\n\n${worktreeNote('02', 'presence-hook')}`), {
    label: 'slice-02', model: 'sonnet', effort: 'medium', schema: SLICE_RESULT,
  }),
  () => agent(sliceTask('03-tui-core-ink.md', `${tokenContext}\n\n${worktreeNote('03', 'tui-ink')}`), {
    label: 'slice-03', model: 'opus', effort: 'medium', schema: SLICE_RESULT,
  }),
  () => agent(sliceTask('04-claude-skill.md', `${tokenContext}\n\n${worktreeNote('04', 'claude-skill')}`), {
    label: 'slice-04', model: 'sonnet', effort: 'medium', schema: SLICE_RESULT,
  }),
])
log(`Parallel wave done — 02:${slice02?.allPassed} 03:${slice03?.allPassed} 04:${slice04?.allPassed}`)

const waveResults = { slice02, slice03, slice04 }
const waveFailed = Object.entries(waveResults).filter(([, r]) => !r?.allPassed)
if (waveFailed.length) {
  log(`${waveFailed.map(([k]) => k).join(', ')} did not fully verify. Stopping before merge/packaging.`)
  return { status: 'blocked-in-wave', slice01, ...waveResults }
}

phase('Merge')
log('All three verified independently. Merging worktrees back into master, one at a time...')
const merged = await agent(
  `${PROJECT_CONTEXT}

Your specific task: in ${REPO_DIR}, merge these three self-managed worktree
branches into master, one at a time (not a single three-way merge):
- ${REPO_DIR}-wt-02, branch slice/02-presence-hook
- ${REPO_DIR}-wt-03, branch slice/03-tui-ink
- ${REPO_DIR}-wt-04, branch slice/04-claude-skill

Since all three were built against CONTRACT.md independently, watch
specifically for the failure mode CONTRACT.md exists to prevent — e.g. one
slice assuming a different config-file shape or function arg names than
another. After each merge, re-run that slice's "How to verify" section
against the merged tree (in ${REPO_DIR} itself) to confirm it still passes
post-merge. Once a worktree is merged and verified, remove it (\`git -C
${REPO_DIR} worktree remove <path>\`) to clean up. Report which merges
succeeded and whether post-merge verification held for each.`,
  { label: 'merge-wave', model: 'opus', effort: 'high', schema: SLICE_RESULT }
)
if (!merged?.allPassed) {
  log(`Merge/post-merge verification had problems: ${merged?.summary}. Stopping before packaging.`)
  return { status: 'blocked-at-merge', slice01, ...waveResults, merged }
}

phase('Packaging')
log('Merge clean. Building slice 05 (onboarding + retire ntfy artifacts)...')
const slice05 = await agent(sliceTask('05-onboarding-invite-flow.md'), {
  label: 'slice-05', model: 'sonnet', effort: 'medium', schema: SLICE_RESULT,
})

log(`Done. 05: ${slice05?.allPassed ? 'verified' : 'NOT fully verified — see summary'}`)
return { status: slice05?.allPassed ? 'complete' : 'blocked-at-packaging', slice01, ...waveResults, merged, slice05 }
```

## Notes for whoever runs this

- This script assumes each spawned agent has normal coding tool access
  (Read/Write/Edit/Bash/Grep) — the default for `agent()` calls.
- Parallel-wave agents (02/03/04) create and manage their own git worktrees
  via plain Bash (see `worktreeNote()`) instead of the Workflow tool's
  `isolation: 'worktree'` option — that option ties to the *session's* cwd,
  not the target repo, and failed outright on the first run (see
  `feedback.md` item 2). 01 and 05 run directly in `REPO_DIR` since they're
  not concurrent with anything.
- Real-world consequences of actually invoking this: it will create/modify
  real Convex cloud resources, commit and push real code to the public
  `XamHans/claude-buddy-chat` GitHub repo, and spend real agent/token budget
  across five slices' worth of implementation. Get a explicit go-ahead before
  invoking, don't just run it because the file exists.
