---
description: Pre-merge orchestrator. Runs pb-review, runs e2e-from-pr, classifies each new spec as persist/revert/ask before cleanup, gates the merge with ship/wait/decide. Never auto-merges.
allowed-tools: [Bash, Read, Edit, Skill, AskUserQuestion]
argument-hint: "[--regress]  persist all new specs | [--no-regress]  revert all new specs | [--dry]  run checks only, no merge prompt"
---

# pb-ship

Pre-merge orchestrator. Bundles `pb-review` + `e2e-from-pr` and offers a single conscious self-approval gate. The merge step is never automatic.

## Modes

- **default** — smart classify: every new spec is judged on regress-worthiness. Persist the contracts, revert the throwaway verifies, ask on borderline. The regression suite only grows by what actually deserves to be there.
- **--regress** — persist all new specs (skip classifier, treat everything as long-lived).
- **--no-regress** — revert all new specs (skip classifier, treat everything as one-shot verification).
- **--dry** — run review + verify, skip the merge prompt. Useful for "check before lunch, decide later".

The flags combine: `--regress --dry` persists everything and skips the prompt.

## Steps

### 1. Preflight

Refuse hook-skipping or signing-bypass flags up front — pb-ship is a deliberate gate, never bypass it:

```bash
case " $ARGUMENTS " in
  *" --no-verify "*|*" --no-gpg-sign "*|*" --force "*|*" -f "*)
    echo "pb-ship: refuse — bypass flag detected. The merge gate is non-negotiable."; exit 1;;
esac
```

Smart-classify and revert-cleanup both rely on knowing that every post-run change came from `e2e-from-pr`. Require a clean working tree unless `--regress` is in `$ARGUMENTS` (only `--regress` skips classification entirely, so it can tolerate a dirty tree):

```bash
DIRTY=$(git status --porcelain)
case " $ARGUMENTS " in
  *" --regress "*) ;;
  *)
    if [ -n "$DIRTY" ]; then
      echo "pb-ship: a clean working tree is required for the classifier to work. Commit, stash, or use --regress."
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

### 4. Classify each new spec

Skip this step entirely if `--regress` is in `$ARGUMENTS` (everything stays) or `--no-regress` is in `$ARGUMENTS` (everything goes).

Capture the deltas `e2e-from-pr` produced:

```bash
NEW_FILES=$(git status --porcelain | awk '{print $2}')
```

For each file in `NEW_FILES`, read it and classify against these heuristics. Apply all that match; if signals disagree, fall back to **ask**.

**persist** — at least one of:
- Unit test (`*.test.ts`, `*.test.js`, `*.spec.ts` outside `e2e/`) of pure logic — formula, validator, transform, scorer, blender. No DOM, no network.
- Asserts a security-sensitive contract — auth check on a route, RLS enforcement, webhook signature verification, secret handling.
- Asserts a payment / billing / data-integrity path.
- Block comment or test name explicitly references a fixed bug, regression, or commit SHA.
- Touches a file listed under "preserved load-bearing files" (or equivalent) in the project's `CLAUDE.md`.

**revert** — at least one of:
- Visual / touch-target / spacing / typography assertion (high design volatility).
- File path under a marketing / landing / docs surface (`marketing/`, `(marketing)/`, `landing/`, `/blog/`).
- Asserts an observable that is design-coupled — link text, copy strings, exact color values, layout heights.
- Duplicates assertions already present in another spec (grep the existing suite for the same selector/data shape).
- Only purpose is "page renders without errors" smoke that is already covered.

**ask** — none of the above match decisively, or persist and revert both match:
- E2E for a non-critical user flow.
- API contract on a surface that is still iterating.
- New test infrastructure that may stabilize later.

Build a classification table:

```
File                                        | Verdict   | Reason
e2e/tests/marketing-nav.spec.ts             | revert    | visual / marketing surface, design-volatile
tests/blend.test.ts                         | persist   | pure logic on lib/forecast/blend (load-bearing)
tests/ical-token-rotation.test.ts           | persist   | security contract — auth/token path
e2e/tests/forecast-empty-state.spec.ts      | ask       | UX flow on iterating surface
```

For each **ask**, use the `AskUserQuestion` tool — one question per file, with three options: persist / revert / skip-and-ask-later. Apply the user's answer.

Print the final table before cleanup.

### 5. Selective cleanup

Act on the classifications from step 4.

```bash
# Build two lists from the table:
#   PERSIST_FILES — leave alone
#   REVERT_FILES  — restore tracked, remove untracked

while IFS= read -r f; do
  [ -z "$f" ] && continue
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    git checkout -- "$f"
  else
    rm -f "$f"
  fi
done <<< "$REVERT_FILES"
```

With `--regress`: skip cleanup entirely, everything persists.
With `--no-regress`: revert all new files, equivalent to the original verify-mode.

The clean-tree preflight in step 1 makes the per-file revert safe — every change at this point came from `e2e-from-pr`.

### 6. Gate

If `--dry` is in `$ARGUMENTS`: skip to step 8.

Use the `AskUserQuestion` tool with these three options:

- **ship** — squash-merge the PR now
- **wait** — leave the PR open, exit
- **decide** — log a CIL decision first (success criteria, meet-moment, evidence), then re-run `pb-ship` when ready

### 7. Action

Based on the user's choice:

- **ship** → invoke the `squash-merge` skill on this PR. The skill handles commit-message crafting, branch cleanup, and the actual merge.
- **wait** → exit. Print the PR URL.
- **decide** → invoke `cil-decide` with the PR context. After the decision lands, instruct the user to re-run `/pb-ship` when they are ready to ship.

### 8. Report

```
pb-ship: <shipped | left-open | decided | dry-pass | dry-fail | blocked>
  pb-review:   N findings (X BLOCKER, Y IMPORTANT, Z NIT)
  verify:      K test-plan items, all pass (or: M failed)
  classify:    P persisted, R reverted, A asked
  mode:        smart | regress | no-regress
  PR:          <url>
```

End with one sentence on what the next action is, if any. No emojis, no exclamation marks.
