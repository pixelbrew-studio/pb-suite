---
description: Lean pre-merge gate. Reviews the diff, adds cross-family review only for strict changes, verifies required CI and relevant previews, confirms the exact squash message once, then follows the merge commit through production.
allowed-tools: [Bash, Read, AskUserQuestion]
argument-hint: "[--dry]  run the gate without offering to merge"
---

# pb-ship

Review diff -> cross-family review only if strict -> required CI and relevant previews -> one merge confirmation -> merge -> follow the exact production deployment.

Read-only until the user approves the displayed squash commit message. Never edits code, creates tests, or re-runs checks already proven by required CI.

## Steps

### 1. Preflight

Refuse bypasses and require a clean, fully pushed PR head:

```bash
case " $ARGUMENTS " in
  *" --no-verify "*|*" --no-gpg-sign "*|*" --force "*|*" -f "*|*" --no-preview "*|*" --no-follow "*)
    echo "pb-ship: refuse — bypass flag detected. The merge gate is non-negotiable."; exit 1;;
esac

[ -z "$(git status --porcelain)" ] || {
  echo "pb-ship: working tree is not clean; commit or stash before shipping"; exit 1; }

gh pr view --json number,url,title,body,state,mergedAt,headRefOid,baseRefName
git rev-parse HEAD
```

Stop when any precondition fails:

- No PR: open one first.
- `state: MERGED`: the checks belong to work already landed; any newer local commits need another PR.
- `state: CLOSED`: reopen it or open another PR.
- Local `HEAD` differs from `headRefOid`: push before continuing.

A green check on an older PR head proves nothing about the current commit.

### 2. Review the diff

```bash
source "$HOME/.claude/commands/pb-bootstrap.sh"
source "$PB_SUITE/scripts/lib/scope.sh"
git diff --stat "$BASE"...HEAD
git diff "$BASE"...HEAD
```

Read the complete diff. Apply `/pb-review`'s correctness, safety, completeness, and severity rules without editing files or running its local test step. Report BLOCKER, IMPORTANT, and NIT findings. Any BLOCKER stops the gate.

Do not run lint, typecheck, build, or the full test suite locally when required CI covers them. The next step reads that evidence directly.

### 3. Cross-family review, strict changes only

Classify the diff using the project's `## Workflow (pb-suite)` risk buckets and `## pb-suite: load-bearing files` globs. Standard CRUD, tooling, docs, copy, and visual-only changes skip this step.

For a strict or load-bearing diff, require a completed review of the branch diff by a frontier-tier model from a different family than the author. Give it the diff, intent, and risk bucket, then ask what is wrong. Do not give it a failure-mode checklist. Dispatch long reviews in the background, read the result, record the resolved model id, and triage findings through the suite severity model. Any BLOCKER stops the gate.

**OpenCode fallback.** If the preferred Claude/Codex reviewer is unavailable, resolve `PB_OPENCODE_REVIEW_MODEL` to an available frontier-tier GLM or Grok `provider/model`, then use `opencode run --agent plan --model "$PB_OPENCODE_REVIEW_MODEL"`. An unset, unavailable, mid-tier, same-family, or write-capable fallback does not satisfy the gate.

### 4. Required CI, migration parity, and relevant previews

Wait for every required check on the exact PR head and fail closed on red, cancelled, or missing checks:

```bash
gh pr checks --required --watch --fail-fast
```

Never re-run an identical local lint, typecheck, build, or test command after its required check is green.

**Migration parity.** If the diff touches migrations, schema files, or migration configuration, read the project's instructions and workflows. Accept a green required check only when it explicitly proves migration parity; otherwise run the repository's existing parity command. If neither exists, stop: schema-changing work has no migration-parity evidence. Do not invent a generic database command.

**Previews.** Determine affected deployable applications from the changed paths. For each affected app, require its preview deployment to be Ready and run its existing `e2e:preview` command when present. Do not create specs. Skip preview infrastructure entirely for tooling, docs, tests, or other diffs that change no deployable application. A missing or failed preview for an affected app blocks the merge.

If `--dry` was requested, report the gate result and stop here.

### 5. One merge confirmation

Read the PR commits and recent base-branch commit style. Draft the exact squash commit:

- Subject: one conventional-commit line summarizing the whole PR, ending in `(#N)`.
- Body: concise explanation of what changed and why.
- No co-author or automation attribution.

Display the subject and body, then ask once: merge this PR with this exact message, or leave it open? This is the only approval prompt in `/pb-ship`. If the user requests wording changes, revise the message and treat their explicit approval of that revision as the merge approval; never add a second confirmation.

On approval:

```bash
gh pr merge "$PR" --squash --subject "$SUBJECT" --body "$BODY"
```

### 6. Follow the exact merge commit

Track the merge SHA, never the moving base branch:

```bash
BASE=$(gh pr view "$PR" --json baseRefName --jq .baseRefName)
SHA=$(gh pr view "$PR" --json mergeCommit --jq '.mergeCommit.oid')
[ -n "$SHA" ] && [ "$SHA" != "null" ] || {
  echo "pb-ship: no merge commit — the PR did not merge"; exit 1; }
```

Poll briefly for the base-branch workflow run whose `headSha` equals `$SHA`, then watch that run with `gh run watch --exit-status`. On failure, report `gh run view --log-failed` and stop. On cancellation, confirm `$SHA` is an ancestor of the new base head with `git merge-base --is-ancestor`; only then follow the superseding SHA.

For every affected deployable app, query deployments by the tracked SHA and follow its production status until success, failure, or a five-minute timeout. Report the environment and log URLs. No deployment is a valid skip only when the diff changed no deployable app or the repository declares no production deployment.

If `CLAUDE.md` declares a `## pb-suite: health check` URL, request it after deployment and require 2xx. Report failures; do not mutate production or weaken checks to reach green.

### 7. Report

```text
pb-ship: <shipped | left-open | dry-pass | blocked>
  review:         N findings (X BLOCKER, Y IMPORTANT, Z NIT)
  cross-family:   <pass, model | skipped — non-strict>
  required CI:    <pass | fail>
  migration:      <pass | skipped — unchanged>
  previews:       <apps pass | skipped — no app changed>
  PR:             <url>
  landed:         <CI / deploy / health statuses> at <merge SHA>
```

Omit `landed` unless the PR merged. End with the single next action, if any.
