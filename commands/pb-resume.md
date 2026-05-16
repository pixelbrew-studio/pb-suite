---
description: Where was I on this repo — git state, recent activity, open PRs, CI status, suggested next step. Solo-founder context recovery after a break.
allowed-tools: [Bash, Read]
argument-hint: "[--days N]  (default --days 7)"
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

- Uncommitted work + last commit fresh (<2h) → "Finish committing what you started."
- Uncommitted work + last commit stale → "Decide whether to commit or stash the working changes."
- Open PR with CI red → "Fix CI on PR #N first."
- Open PR with CI green + no reviews → "Merge PR #N or request review."
- Branch ahead of upstream (unpushed) → "Push your N unpushed commits."
- Clean tree + open PRs all merged/green + no activity in $DAYS days → "Project is idle. Run `/cil-pulse` to surface what's stale."
- Otherwise → "Start the next planned slice."

One sentence. The suggestion is a nudge, not a plan.

## Out of scope (v1)

- Linear / Notion crossref. The hook is `--cil`; not implemented in v1. When implemented, will use `~/Pixelbrew/CIL/scripts/linear.ts` and `~/Pixelbrew/CIL/scripts/notion.ts` if present.
- Multi-repo. For portfolio-wide state, use `/pb-across pb-resume` once both exist.
- Deploy status. Belongs in `pb-deploy-verify`, not here.
