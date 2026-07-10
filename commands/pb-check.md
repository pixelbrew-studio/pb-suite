---
description: Comprehensive single-call audit. Runs pb-review + pb-design-review (if UI) + pb-cso --diff + pb-qa (if URL), then aggregates findings across passes and surfaces patterns to learn from. No merge, no test-run — pure audit.
allowed-tools: [Bash, Read, Edit, Grep, Glob, AskUserQuestion]
argument-hint: "[url]  optional dev-server URL for pb-qa + pb-design-review live pass"
---

# pb-check

One call, all review-passes. Use when you want a full picture of a diff — code, design, security, runtime — and you would rather not remember which command does what. The orchestrator runs each pass, captures findings, then aggregates them across passes so you can see the bigger picture.

Distinct from `/pb-ship`: ship is the path to merge (review + e2e-from-pr + gate). Check is the path to understand. No merge, no test-suite mutation, no commits.

The point of running them together is the **Lessons** section at the end: patterns that appear in more than one pass, recurring themes specific to this project, blind spots worth fixing structurally.

## Steps

### 1. Scope detection

Refuse destructive flags first — pb-check is read-only and every spawned pass must stay read-only regardless of what got passed in:

```bash
case " $ARGUMENTS " in
  *" --fix "*|*" --write "*|*" --update-snapshots "*|*" --update "*|*" -u "*)
    echo "pb-check: refuse — destructive flag detected. pb-check is read-only."; exit 1;;
esac
```

Resolve the suite location and base ref (bootstrap honors `PB_SUITE_HOME` override):

```bash
source "$HOME/.claude/commands/pb-bootstrap.sh"
source "$PB_SUITE/scripts/lib/scope.sh"
```

Build the file list. Include committed-vs-base **and** working-tree changes (staged, unstaged, untracked) — otherwise a branch with zero commits beyond BASE silently audits an empty diff:

```bash
{ git diff --name-only "$BASE"...HEAD; \
  git diff --name-only HEAD; \
  git ls-files --others --exclude-standard; } \
  | sort -u > /tmp/pb-check-files.txt

COMMITTED=$(git rev-list --count "$BASE"...HEAD 2>/dev/null || echo 0)
TOTAL=$(wc -l < /tmp/pb-check-files.txt | tr -d ' ')
UI=$(grep -E '\.(tsx?|jsx?|vue|svelte|astro|css|scss|html)$|tailwind\.config|globals\.css' /tmp/pb-check-files.txt | wc -l | tr -d ' ')

if [ "$COMMITTED" -eq 0 ] && [ "$TOTAL" -gt 0 ]; then
  echo "Note: 0 commits beyond $BASE — reviewing uncommitted working tree only."
fi
echo "Files changed: $TOTAL (UI: $UI, committed: $COMMITTED)"
```

If `$TOTAL` is 0: stop. There is nothing to check.

Extract URL from `$ARGUMENTS` if present (strip any flags first). URL triggers the runtime passes.

### 2. Run pb-review (always)

Execute the steps from `pb-review.md` against the diff. Capture: BLOCKER, IMPORTANT, NIT counts and the per-finding detail. Do not auto-fix here — `/pb-check` is read-only, fixes happen when the user runs `/pb-review` directly or `/pb-ship`.

### 3. Run pb-design-review (only if UI files changed)

If `UI > 0`, execute the steps from `pb-design-review.md`. Pass through the URL if given. Capture findings and (if URL was given) the structured-critique output.

If `UI = 0`: log "skipped — no UI files in diff" and continue.

### 4. Run pb-cso --diff (always)

Execute the steps from `pb-cso.md` in `--diff` mode (scoped to the diff, not full-repo). The full-repo CSO pass is too slow for every check; the diff-scoped version focuses on the OWASP / STRIDE concerns introduced by this change.

### 5. Run pb-qa (only if URL was given)

If `$ARGUMENTS` contains a URL, execute the steps from `pb-qa.md` against it. Auto-discovery is fine — the goal is "did anything new break at runtime", not full coverage.

If no URL: log "skipped — no URL given" and continue.

### 6. Aggregate

Build one combined finding table across the passes:

- **Cross-reference by file**: a file flagged by multiple passes is interesting — escalate its visible severity to the highest among them. Note which passes flagged it.
- **Cross-reference by root**: a missing auth check appearing in both `pb-review` (code path) and `pb-cso` (OWASP A01) is the same finding seen from two angles. Bundle them.
- **De-duplicate**: identical content from two passes (rare, but happens with the design-review/UX-design overlap) — keep one, mark which pass(es) saw it.

### 7. Lessons (the point of this command)

This is where the value lives. After aggregation, identify **1-3 patterns** that emerge from the combined findings. Patterns are observations across findings, not the findings themselves.

Examples of good lesson observations:

- "Three of the IMPORTANT findings touch the same auth middleware — `proxy.ts` is doing too many things. Worth a refactor before the next auth-adjacent feature lands."
- "Hardcoded hex colors appeared in both `pb-review` (no token) and `pb-design-review` (Refactoring UI §5). Pattern: this branch was written without the design-token discipline. Consider a pre-commit hook to flag hex literals."
- "The redirect-target bug (`pb-qa`) and the open-redirect (`pb-cso`) both involve `next` param handling. The whole next-param surface is suspect — schedule a `/pb-investigate` session on auth flow before more features land here."

Lessons are **observations + one actionable takeaway each**. Not "you should fix X" (that is in the findings) but "here is what to do differently structurally".

If you cannot find 1-3 substantive patterns, say so explicitly: "No cross-pass patterns this run — the diff is focused and clean." Do not fabricate lessons.

### 8. Report

```
pb-check: comprehensive audit
Branch: <name>  vs  <base>
Files:  N changed (UI: M)

Passes:
  pb-review:        A findings (X BLOCKER, Y IMPORTANT, Z NIT)
  pb-design-review: B findings (...) [or "skipped — no UI"]
  pb-cso (--diff):  C findings (...)
  pb-qa:            D findings (...) [or "skipped — no URL"]

Aggregated findings:
  [BLOCKER]
    <file:line> — <bundled finding from multiple passes if applicable>
      seen by: pb-review, pb-cso
  [IMPORTANT]
    ...
  [NIT]
    ...

Lessons:
  1. <pattern observation>
     → <actionable takeaway>
  2. ...
  3. ...

Next:
  - Fix BLOCKERs (the suite does not auto-fix here)
  - Run /pb-ship when ready to land
  - Consider /pb-investigate on: <recurring-theme topic, if any>
```

### 9. Persistence

Lessons are where the value compounds, so they save by default when there is a signal the user maintains written context for this repo.

```bash
LESSONS_TARGET=""
[ -f CLAUDE.md ] && LESSONS_TARGET=".claude/lessons.md"
LESSONS_LINES=0
[ -f "$LESSONS_TARGET" ] && LESSONS_LINES=$(wc -l < "$LESSONS_TARGET" | tr -d ' ')
```

Behavior:

- **`CLAUDE.md` exists, lessons file under 500 lines** — auto-append to `.claude/lessons.md` (create the dir if missing). Print path of the appended file in the final report.
- **`CLAUDE.md` exists, lessons file ≥ 500 lines** — ask via `AskUserQuestion` whether to append, archive-and-restart (`mv .claude/lessons.md .claude/lessons-$(date +%Y%m).md`), or skip. The threshold prevents a single file growing into a megabyte of stale patterns.
- **No `CLAUDE.md`** — ask via `AskUserQuestion`: save to `LESSONS.md` at repo root, save to a path the user specifies, or skip.

Append format:

```
## <YYYY-MM-DD> — <branch>
<lessons content>

---
```

The `---` separator makes per-run blocks visually scannable when the file grows. Date and branch make it greppable.

Over time, this file becomes a per-project pattern log — the structural drift you would otherwise forget between PRs.
