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

## What's still good from this run

Slice 01 itself is fully built and verified (schema, auth-by-token, all 5
functions, 10 passing tests, verified live including the curl-based path) —
nothing here needs to be redone. Only the parallel-wave mechanics need
fixing before retrying 02/03/04.
