---
description: Pre-landing review of pending changes. Flags issues by severity, auto-fixes the obvious, asks before the risky, never skips tests.
allowed-tools: [Bash, Read, Edit, Grep, Glob]
---

# pb-review

Pre-landing review of the current branch. Reads the diff against the base branch, runs focused checks, categorizes findings, and acts proportionally — auto-fix the obvious, ask before the risky, never silence tests.

Focus on what breaks in production: correctness, safety, completeness. Style nitpicks only if egregious.

## Steps

### 1. Determine scope

Use the shared scope-detection helper. For a feature branch it diffs against the integration branch (`origin/main` or equivalent), not the branch's own remote — `@{u}` on a feature branch resolves to `origin/<feature>` and produces an empty diff. Only on `main`/`master` does it fall back to upstream (reviewing unpushed commits).

```bash
source "$HOME/.claude/commands/pb-bootstrap.sh"
source "$PB_SUITE/scripts/lib/scope.sh"
git status -s
git diff --stat "$BASE"...HEAD
```

Include uncommitted changes by default. Auto-fixes go to the working tree only.

**Scope-creep check.** Compare working-tree changes against committed scope:

```bash
git diff --name-only "$BASE"...HEAD | sort -u > /tmp/pb-committed.txt
git diff --name-only HEAD | sort -u > /tmp/pb-worktree.txt
comm -13 /tmp/pb-committed.txt /tmp/pb-worktree.txt
```

If the working tree touches files outside the committed scope, surface that before reviewing. Either the user wants them in this PR (then review them all) or they are unrelated WIP that should be stashed (then review only the committed scope).

### 2. Read the diff

```bash
git diff "$BASE"...HEAD
```

Read all of it. Identify intent (fix / feature / refactor / mixed) and hold that frame for the rest of the review. A "fix" with a hidden refactor is a smell.

### 3. Focused checks

Run in order. Stop early if a finding warrants discussion before continuing.

**Correctness**
- Off-by-one, null/undefined deref, missing `await`, wrong comparison operator
- Race conditions on shared state, double-spend on retried operations
- Swallowed errors, error returned but never checked
- Type lies — `as any`, unchecked casts, `@ts-ignore` without a reason in the comment

**Safety** (diff-level quick wins — for deep audit run `/pb-cso --diff`)
- SQL built by string concatenation instead of parameterized
- Untrusted input flowing into `eval`, `exec`, `dangerouslySetInnerHTML`, shell commands
- Secrets in code, logs, or error messages introduced by this diff
- Missing auth check on a new route that handles user data

**Completeness**
- New function, route, or branch with no test covering it
- New error case with only `console.log` or a swallow
- Obvious missed edge cases — empty array, zero, null, very large input, unicode, timezone
- Skipped or focused tests left in: `xit`, `.skip`, `.only`, `describe.only`

**Maintainability** (only flag egregious)
- Dead code introduced
- Obvious duplication where a helper would clearly serve
- Magic numbers or strings without context
- Comments that contradict the code

### 4. Categorize and act

For each finding, assign one severity:

- **BLOCKER** — bug, safety issue, broken or skipped test. Auto-fix if the change is local to the diff and behavior is preserved or trivially corrected (typo, missing `await` where the value is awaited downstream, leftover `console.log`, `xit` → `it`). Otherwise list it.
- **IMPORTANT** — completeness gap, missing test for new logic, suspicious pattern. Ask before fixing.
- **NIT** — style or minor cleanup. Mention in one line. Do not fix unless asked.

Never auto-fix: cross-file behavioral changes, anything in a security-sensitive path, anything that adds or removes a test, anything where the right fix is not obvious from the diff alone.

### 5. Run tests

If a test runner is configured (`package.json` test script, `pytest`, `cargo test`, `go test`, `bun test`), run it after any auto-fixes. Report pass/fail.

The merge gate is green tests plus conscious self-approval. If a test is failing, do not "make it pass" by editing the test — investigate the failure.

### 6. Report

End with this exact format:

```
Review: N findings — X BLOCKER, Y IMPORTANT, Z NIT
Auto-fixed:
  - <bullet per fix, with file:line>
Needs your call:
  - <bullet per finding, with file:line and the question>
Tests: <pass | fail | none configured>
```

Then ask: continue or discuss findings?

Do not push, stage, commit, or open a PR. That is `/release` or the user's explicit next step.
