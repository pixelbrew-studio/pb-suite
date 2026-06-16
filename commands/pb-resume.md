---
description: Where was I on this repo — git state, recent activity, open PRs, CI status, suggested next step. Solo-founder context recovery after a break. Adds Linear/Notion context automatically inside a CIL repo (detected via CIL/sources.md).
allowed-tools: [Bash, Read]
argument-hint: "[--days N]  (default --days 7) | [--no-cil]  skip CIL bridge even in a CIL repo"
---

# pb-resume

Reads the current repo's state and recent activity into a single page. Designed for the moment you re-open a project after days away and need to remember where you were.

Read-only. Never edits, commits, or pushes.

## Steps

### 1. Verify and identify

```bash
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "pb-resume: not a git repo"; exit 1; }
REPO=$(basename "$(git rev-parse --show-toplevel)")
BRANCH=$(git branch --show-current)
DAYS=7
case " $ARGUMENTS " in *" --days "*) DAYS=$(echo "$ARGUMENTS" | awk '{for(i=1;i<=NF;i++) if($i=="--days") print $(i+1)}');; esac
```

### 2. Working tree

```bash
git status -s
git log -1 --format='%h %s (%cr)'
git rev-list --left-right --count "@{u}...HEAD" 2>/dev/null
```

If `@{u}` errors out (no upstream), note "no upstream set" — do not fail.

### 3. Recent activity

```bash
git log --since="$DAYS days ago" --format='%h %ad %s' --date=short | head -20
git log --since="$DAYS days ago" --name-only --format='' | sort -u | grep -v '^$' | head -20
```

Truncate per-list to ~20. Point is to remind, not dump the log.

### 4. Open PRs and CI

```bash
gh pr list --author "@me" --state open --json number,title,headRefName,statusCheckRollup,updatedAt --limit 10 2>/dev/null
gh run list --branch "$BRANCH" --limit 3 --json conclusion,name,createdAt,headSha 2>/dev/null
```

If `gh` is unauthenticated or the repo has no GitHub remote: skip both with a one-line note. Do not block the resume.

### 4b. CIL bridge (when `CIL/sources.md` exists and `--no-cil` is not set)

```bash
source "$HOME/.claude/commands/pb-bootstrap.sh"
source "$PB_SUITE/scripts/lib/cil.sh"
if cil_repo_p && ! echo " $ARGUMENTS " | grep -q -- " --no-cil "; then
  CIL_ACTIVE=1
fi
```

When active, gather two short sections — each capped at five lines, single page stays single page:

- **Linear (assigned, In Progress + Todo)** — use the Linear MCP if available (e.g. `mcp__plugin_linear__*` or any tool whose name contains `linear`). Filter to current user's open tickets. One line per ticket: `<KEY> <title> [<state>] <updated-relative>`. If a ticket key matches the current branch (see `cil_linear_ticket_from_branch`), prefix that line with `*`.
- **Notion specs touched in the last $DAYS days** — best-effort. If a Notion MCP is available, search pages updated in window whose title includes the repo name or any file path token from step 3. One line per page: `<title> — updated <relative>`. Skip silently if no MCP / no matches.

Do not block on MCP failure — if the call errors or no MCP is connected, drop the section and continue. The CIL bridge is additive, never load-bearing for `pb-resume` itself.

### 5. Report

```
pb-resume: $REPO @ $BRANCH

Working tree
  <clean | N modified, M staged, K untracked>
  Last commit:   <hash> "<subject>" (<relative>)
  vs upstream:   <ahead K, behind L | up-to-date | no upstream>

Recent (last $DAYS days)
  <date> <hash> <subject>
  ...
  Files touched: <comma-separated list, truncated to one line>

Open PRs (yours)
  #<n> "<title>" [<branch>]  CI:<pass|fail|pending|none>  updated <relative>
  ...

CI on $BRANCH
  <conclusion> <name> <relative>
  ...
```

### 6. Suggest the next step

Apply rules in order. Output the first that matches:

- Uncommitted work + last commit fresh (<2h) → "Finish committing what you started, then `/pb-review`."
- Uncommitted work + last commit stale → "Decide whether to commit or stash. If unsure what's in flight: `/pb-tdd --auto` proposes slices from the working tree."
- Open PR with CI red → "Fix CI on PR #N first — `/pb-investigate` if the failure isn't obvious."
- Open PR with CI green + no reviews → "Run `/pb-check` for a final read, then merge PR #N via `/pb-ship`."
- Branch ahead of upstream (unpushed) → "Push your N unpushed commits."
- Recent activity is mostly marketing/copy files → "Try `/pb-copy --mode brand-check` before the next push."
- Clean tree + open PRs all merged/green + no activity in $DAYS days → "Project is idle. Run `/cil-pulse` to surface what's stale." (or, if `cil_repo_p`, suggest `/cil-pulse` directly)
- Otherwise → "Start the next planned slice — `/pb-tdd <description>`."

One sentence. The suggestion is a nudge, not a plan.

## Out of scope (v1)

- Multi-repo. For portfolio-wide state, use `/pb-across pb-resume`.
- Deploy status. Belongs in `pb-deploy-verify`, not here.
- Heavy CIL synthesis (drift detection, decision evaluation). That is `/cil-pulse` / `/cil-gap` — `pb-resume` only surfaces enough Linear/Notion context to remember the branch.
