---
description: Audit a repo's test suite for likely-obsolete specs — broken imports, all-skipped files, references to long-merged PRs. Report-only by default. No deletions without explicit user approval.
allowed-tools: [Bash, Read, Edit, AskUserQuestion]
argument-hint: "[--include-co-located] [--pr-age-days N] [--gh-repo owner/name]"
---

# pb-prune-tests

Scan the current repo's test suite for likely-obsolete specs. Three detection rules:

- **broken-import** — the spec imports a path that no longer exists. The test cannot run, deleting is safe.
- **all-skipped** — every `it` / `test` in the file uses `.skip` / `xit` / `xtest`. The file is dead weight in CI but contributes nothing.
- **stale-pr-ref** — the file references a merged PR older than `--pr-age-days` (default 90). One of the e2e-from-pr artifacts that probably outlived its purpose.

This is the opruim-tool for the test-suite bloat that grew under e2e-from-pr's default behavior. `/pb-ship --regress` was the fix going forward; `/pb-prune-tests` is the fix for what is already in the tree.

Report-only by default. Deletions require explicit user approval per file or per severity bucket.

## Steps

### 1. Resolve the script

```bash
source "$HOME/.claude/commands/pb-bootstrap.sh"
PB_SCRIPT="$PB_SUITE/scripts/prune-tests.ts"
[ -f "$PB_SCRIPT" ] || { echo "pb-prune-tests: script not found, run $PB_SUITE/install"; exit 1; }
```

### 2. Run the scan

```bash
bun "$PB_SCRIPT" "$(pwd)" $ARGUMENTS
```

The script runs `gh pr view` per PR-ref it finds; on a repo with many old PR-references this can take a minute. Default scope is `tests/`, `e2e/`, and `__tests__/`. Add `--include-co-located` to also scan `src/**/*.test.ts`.

If `gh` cannot resolve a PR (rate limit, wrong repo): the stale-pr-ref check is skipped silently for that file. Use `--gh-repo owner/name` when running from outside the repo or when `gh` defaults pick the wrong one.

### 3. Read the JSON

The output has `{ root, scanned, totals, findings }`. Findings are pre-classified:

- **safe-delete** — broken-import. Test cannot run. Confidence high.
- **likely-delete** — all-skipped. File adds no coverage. Confidence high.
- **review** — stale-pr-ref. Could still be valuable regression coverage — needs eyes.

### 4. Present findings

Group by severity. For each finding, show: path, total/skipped test counts, line count, the specific reasons. Format:

```
pb-prune-tests scan of <root>
Scanned: N files | Findings: A safe-delete, B likely-delete, C review

[safe-delete]
  e2e/tests/old-feature.spec.ts (89 lines, 6 tests)
    broken-import: @/lib/forecast/old-blend → not found

[likely-delete]
  e2e/tests/disabled.spec.ts (45 lines, 3 tests, all .skip)
    all-skipped: all 3 test cases use .skip / xit / xtest

[review]
  e2e/tests/auth-pix-23.spec.ts (120 lines, 4 tests)
    stale-pr-ref: PR #23 merged 140 days ago
```

### 5. Decide

Use `AskUserQuestion` with these options:

- **delete safe-delete** — remove all safe-delete files (broken imports, can't run anyway)
- **delete safe + likely** — also remove all-skipped files
- **selective** — go file-by-file
- **report only** — exit, no changes

On **selective**, loop over the findings list and ask per file: delete / keep / skip-this-one.

### 6. Execute (only if user chose to delete)

For each approved file, remove it:

```bash
git rm "$path"
```

After all removals, suggest running the project's test suite to confirm nothing in the kept files depended on a deleted helper file:

```bash
# whatever the project's test runner is — npm test, bun run test, pnpm test, etc.
```

Do not commit. The user reviews the deletions in `git status` and commits with their own message.

### 7. Report

```
pb-prune-tests: <deleted N files | report only>
  Safe-delete:    K removed of L candidates
  Likely-delete:  M removed of N candidates
  Review:         <listed for user — not auto-removed>
Test run after deletion: <pass | fail | skipped>
```

If any tests started failing after deletion, surface that immediately — it means a kept spec imported from a deleted helper. Either restore the helper or update the kept spec.

## What it does not detect

- **Duplicate coverage** — two specs asserting the same thing. Would need semantic analysis or running tests with coverage maps; out of scope for v1.
- **Specs that pass for the wrong reason** — coverage exists, but it's coincidence. The opposite problem from this command.
- **Stale snapshots** — `__snapshots__/` files that no spec references. Could be added later.
- **Routes that no longer exist in `src/app/`** — could be detected for Next.js App Router; added as a heuristic later if the broken-import check is not enough.
