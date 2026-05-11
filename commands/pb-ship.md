---
description: Pre-merge orchestrator. Runs pb-review, verifies the test plan via e2e-from-pr in temporary mode, gates the merge with ship/wait/decide. Never auto-merges.
allowed-tools: [Bash, Read, Edit, Skill, AskUserQuestion]
argument-hint: "[--regress]  persist verify specs to permanent suite | [--dry]  run checks only, no merge prompt"
---

# pb-ship

Pre-merge orchestrator. Bundles `pb-review` + `e2e-from-pr` and offers a single conscious self-approval gate. The merge step is never automatic.

## Modes

- **default** — verify mode: `e2e-from-pr` writes specs, they run once, then they are deleted. The regression suite stays the size it was.
- **--regress** — promote: specs land in the project's permanent test directory. Use only for features that genuinely need long-lived regression coverage.
- **--dry** — run review + verify, skip the merge prompt. Useful for "check before lunch, decide later".

The flags combine: `--regress --dry` runs everything, persists specs, no prompt.

## Steps

### 1. Preflight

Verify mode revert-cleanup needs a clean tree. Require it unless `--regress` is in `$ARGUMENTS`:

```bash
DIRTY=$(git status --porcelain)
case " $ARGUMENTS " in
  *" --regress "*) ;;
  *)
    if [ -n "$DIRTY" ]; then
      echo "pb-ship: verify mode needs a clean working tree. Commit, stash, or use --regress."
      exit 1
    fi
    ;;
esac
```

Find the PR for the current branch:

```bash
gh pr view --json number,url,title,body 2>/dev/null
```

If no PR: stop and tell the user to open one first. `pb-ship` is not for un-PR'd work.

### 2. pb-review

Invoke `pb-review`. Wait for completion. Read the BLOCKER count from its report.

If `BLOCKER ≥ 1`: stop here. Surface the findings. Do not run verify. Do not prompt for merge.

### 3. e2e-from-pr

Invoke `e2e-from-pr` on the current PR.

The skill writes specs to the project's permanent test locations (`e2e/tests/`, `tests/`, etc.) and runs them. Read its report:

- All items pass → step 4
- Any item fails → stop, surface the failure, do not prompt for merge

### 4. Cleanup (verify mode only)

If `--regress` is NOT in `$ARGUMENTS`, revert everything `e2e-from-pr` wrote:

```bash
case " $ARGUMENTS " in
  *" --regress "*)
    echo "pb-ship: --regress active, specs persisted to permanent suite"
    ;;
  *)
    git checkout -- .
    git clean -fd
    echo "pb-ship: verify specs reverted, regression suite unchanged"
    ;;
esac
```

The clean-tree preflight in step 1 makes `git clean -fd` safe — every untracked file at this point came from `e2e-from-pr`.

### 5. Gate

If `--dry` is in `$ARGUMENTS`: skip to step 7.

Use the `AskUserQuestion` tool with these three options:

- **ship** — squash-merge the PR now
- **wait** — leave the PR open, exit
- **decide** — log a CIL decision first (success criteria, meet-moment, evidence), then re-run `pb-ship` when ready

### 6. Action

Based on the user's choice:

- **ship** → invoke the `squash-merge` skill on this PR. The skill handles commit-message crafting, branch cleanup, and the actual merge.
- **wait** → exit. Print the PR URL.
- **decide** → invoke `cil-decide` with the PR context. After the decision lands, instruct the user to re-run `/pb-ship` when they are ready to ship.

### 7. Report

```
pb-ship: <shipped | left-open | decided | dry-pass | dry-fail | blocked>
  pb-review: N findings (X BLOCKER, Y IMPORTANT, Z NIT)
  verify:    K test-plan items, all pass (or: M failed)
  mode:      verify | regress
  PR:        <url>
```

End with one sentence on what the next action is, if any. No emojis, no exclamation marks.
