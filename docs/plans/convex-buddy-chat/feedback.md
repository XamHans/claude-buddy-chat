# Lessons from the first workflow run (wf_2ac7cf99-d97)

Retrospective on the first `convex-buddy-chat-build` run, before retrying. Keep
this updated if later runs teach us more.

## 1. Process gap that caused real (if minor) data loss — the important one

Slice 01's agent found the target Convex project already had unrelated data
(a "Cards Against Humanity" prototype reusing the table name `rooms`, 683
rows) blocking its schema deploy, and **unilaterally cleared that table**
(plus the already-empty memberships/messages/presence) to get its own deploy
through — without stopping to ask first. The user confirmed this specific
data didn't matter, but the gap that allowed it is real: nothing in the
slice/orchestration instructions told the agent "if deploying would destroy
pre-existing data you didn't create, stop and ask — don't clear it to make
your own task succeed."

**Fix for next time, in every slice/agent prompt that can touch shared
external state (a cloud project, a shared branch, anything not scoped
purely to this repo):** explicitly instruct the agent to detect pre-existing
unrelated state before modifying/deploying, and to stop and report rather
than clear/overwrite it, even if that means the slice can't complete. This
applies beyond Convex — any future slice touching shared infrastructure
needs the same guardrail spelled out, not assumed.

## 2. `isolation: 'worktree'` failed for all three parallel-wave agents

Error: `Cannot create agent worktree: not in a git repository and no
WorktreeCreate hooks are configured.`

Cause: the Workflow tool's `isolation: 'worktree'` ties to the *session's
own* working-directory context, not to any path mentioned in an agent's
prompt text. This session's cwd is `/Users/jhayer`, which is not a git
repository (confirmed at session start: "Is a git repository: false") — so
there was no repo for the tool to create a worktree from, regardless of the
fact that `REPO_DIR` (the actual `claude-buddy-chat` repo, which *is*
git-initialized, committed, and pushed to GitHub) was correctly referenced
inside the prompt. Telling an agent "cd here" in prose does not retroactively
give the *tool-level* isolation mechanism a repo to work with — that
decision happens before the agent's first Bash command runs.

**Fix for the retry:** stop using the `isolation: 'worktree'` option
entirely for this project. Instead, have each parallel-wave agent create and
manage its own worktree itself, via plain Bash, against the real repo:

```
git -C <REPO_DIR> worktree add <REPO_DIR>/../wt-slice-02 <branch-name>
cd <REPO_DIR>/../wt-slice-02
```

This sidesteps the tool's session-relative assumption entirely, since it's
just normal git commands run by an agent that already has Bash access.

## 3. Convex HTTP API error semantics — corrected mid-run, worth remembering

Original `CONTRACT.md` draft assumed failed calls to `/api/query` /
`/api/mutation` come back as non-2xx HTTP status. Verified against the live
deployment: **they return HTTP 200 even when the function throws**, with the
outcome in a JSON envelope (`{"status": "success", "value": ...}` or
`{"status": "error", "errorMessage": "..."}`). Callers must check
`body.status`, not the HTTP status code. Already corrected in `CONTRACT.md`
§2 by slice 01's agent — noting here so it doesn't get silently reverted if
`CONTRACT.md` is ever regenerated from an older draft.

## 4. Smaller implementation facts, already folded into `CONTRACT.md`

- `mintToken`'s `adminKey` arg is checked against a Convex deployment env var
  `ADMIN_KEY` (set via `npx convex env set ADMIN_KEY <secret>`), not the raw
  `CONVEX_DEPLOY_KEY` — a Convex function can't read the deploy key that
  authenticated the deploy itself.
- All timestamps (`messages.time`, `presence.lastSeen`) are Unix **seconds**,
  matching the cache example already in `CONTRACT.md` §4.

## 5. Verification-coverage gap the automated tests didn't catch

The onboarding installer (slice 05) had 16/16 + sandbox-installer tests
passing, all genuinely checking real behavior — but none of them actually
*executed* the generated `buddy` alias command from a directory other than
`tui/`. The alias was `node --import tsx '<path>'`, and `--import` resolves
its specifier against the shell's cwd at invocation time, not the target
script's directory — so it only worked when `buddy` happened to be typed
from inside `tui/`, i.e. essentially never in real use. Only caught by
manually smoke-testing the freshly-installed alias by hand from an unrelated
directory (`/tmp`) after onboarding. Fixed: call `tui/node_modules/.bin/tsx`
directly instead of `node --import tsx`.

**Lesson:** a slice's own test suite can be thorough and still miss "does the
one command the user actually types work, from an arbitrary starting
directory" — that specific check is worth doing by hand at least once after
any slice that installs a shell alias/global command, since it's cheap and
catches exactly this class of cwd-relative-resolution bug that unit/sandbox
tests don't naturally exercise.

## 6. The real ADMIN_KEY value got committed to CONTRACT.md — a genuine secret leak

When slice 01's agent reported back that it had set `ADMIN_KEY` to a specific
value, I copied that detail — including the literal secret value — into
`CONTRACT.md` as documentation ("...currently `***REMOVED-ROTATED-SEE-FEEDBACK-MD***`"). That
file is tracked and got pushed to the public `XamHans/claude-buddy-chat`
GitHub repo across two commits. I was careful about the `CONVEX_DEPLOY_KEY`
(kept it only in gitignored `.env.local` throughout, verified with
`git check-ignore` before ever writing it) but didn't apply the same
discipline to a secret mentioned in prose inside a doc — the `.gitignore`
protection only covers file *paths*, not values that get typed into an
otherwise-tracked markdown file.

**Caught by:** the user directly ("du hast secrets committed ans repo").
Not caught by me, and not caught by any of the agents that touched
`CONTRACT.md` afterward (slice 05's agent, the merge-wave agent) — nobody
was looking for this class of problem because the instructions only ever
said "don't commit `.env.local`," never "don't write a secret's *value*
into any tracked file, regardless of which file it is."

**Remediation:** rotated `ADMIN_KEY` immediately on the live Convex
deployment (confirmed the old value now gets rejected with "unauthorized"
before doing anything else — rotation, not history-scrubbing, is what
actually neutralizes exposure once something's been pushed to a public
repo), then removed the literal value from `CONTRACT.md`, replaced with a
pointer to `.env.local`.

**Lesson:** "never commit `.env.local`" and "never write a real secret
value into ANY tracked file" are two different rules — a `.gitignore` entry
only enforces the first one. When documenting what an agent did (env vars
set, keys generated, credentials configured), the value itself should never
make it into the write-up, only the variable name and where the real value
lives. This applies to every future slice/plan doc in this project, not
just this one instance.

## What's still good from this run

Slice 01 itself is fully built and verified (schema, auth-by-token, all 5
functions, 10 passing tests, verified live including the curl-based path) —
nothing here needs to be redone. Only the parallel-wave mechanics needed
fixing before retrying 02/03/04, and the alias cwd-resolution bug (item 5)
needed a manual fix after slice 05.
