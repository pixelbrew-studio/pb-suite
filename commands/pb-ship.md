---
description: Pre-merge orchestrator. Runs pb-review, runs e2e-from-pr, classifies each new spec as persist/revert/ask before cleanup, gates the merge with ship/wait/decide, then tracks the merge commit through CI and deploy. Never auto-merges.
allowed-tools: [Bash, Read, Edit, Skill, AskUserQuestion]
argument-hint: "[--regress]  persist all new specs | [--no-regress]  revert all new specs | [--dry]  run checks only, no merge prompt | [--no-follow]  skip post-merge verification"
---

# pb-ship

Pre-merge orchestrator. Bundles `pb-review` + `e2e-from-pr` and offers a single conscious self-approval gate. The merge step is never automatic.

## Modes

- **default** — smart classify: every new spec is judged on regress-worthiness. Persist the contracts, revert the throwaway verifies, ask on borderline. The regression suite only grows by what actually deserves to be there.
- **--regress** — persist all new specs (skip classifier, treat everything as long-lived).
- **--no-regress** — revert all new specs (skip classifier, treat everything as one-shot verification).
- **--dry** — run review + verify, skip the merge prompt. Useful for "check before lunch, decide later".
- **--no-follow** — merge and exit without tracking the commit through CI and deploy (step 7b).

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

Verify every required status check can still be produced. A renamed or folded CI job orphans its ruleset context: the check can never report, so every PR blocks forever on "Expected — waiting for status" and the symptom points nowhere near the cause. Report, do not fail — the fix is a ruleset write, which is the user's call:

```bash
RS=$(gh api repos/:owner/:repo/rulesets --jq '.[] | select(.target=="branch") | .id' 2>/dev/null | head -1)
if [ -n "$RS" ]; then
  gh api "repos/:owner/:repo/rulesets/$RS" \
    --jq '.rules[] | select(.type=="required_status_checks")
          | .parameters.required_status_checks[].context' 2>/dev/null > /tmp/pb-required.txt
  grep -rhE '^\s{4}name:' .github/workflows/*.yml 2>/dev/null | sed 's/^ *name: *//' > /tmp/pb-jobs.txt
  while IFS= read -r ctx; do
    [ -z "$ctx" ] && continue
    # Deploy-platform and bot contexts are posted by external apps, not job names.
    case "$ctx" in Vercel*|*Preview*|*"Agent Review"*) continue;; esac
    grep -Fqx "$ctx" /tmp/pb-jobs.txt ||
      echo "pb-ship: required check '$ctx' matches no job name in .github/workflows — merges will block forever"
  done < /tmp/pb-required.txt
fi
```

Use the ruleset API, not `repos/:owner/:repo/branches/<b>/protection` — the classic endpoint 404s on a ruleset-protected repo, which reads as "unprotected" and is wrong. When repairing a ruleset, build the `PUT` payload from the live `gh api repos/:owner/:repo/rulesets/<id>` response so the other rules survive the write.

Find the PR for the current branch, and check its **state**, not just its existence:

```bash
gh pr view --json number,url,title,body,state,mergedAt,headRefOid 2>/dev/null
```

- **No PR** → stop and tell the user to open one first. `pb-ship` is not for un-PR'd work.
- **`state: MERGED`** → stop. There is no gate left to run: the change is on the base branch and every check from here reports on work that already landed. Say so plainly, and say what the local commits ahead of the PR head are — they are unmerged work needing their own branch and PR, not part of this one.
- **`state: CLOSED`** (not merged) → stop. A closed PR does not sync new pushes, so anything committed since is invisible to it. Reopen it or open a new one.

```bash
git rev-parse HEAD                 # compare against headRefOid above
```

A local `HEAD` ahead of `headRefOid` means the PR does not contain your latest commits. On an open PR, push. On a merged one, those commits need a new branch — and any check that came back green belongs to the PR head, not to what is in front of you.

This is the failure that reads as success: a merged PR still answers `gh pr checks` with a green result, so a gate run against it looks like it passed. It passed for a commit you are no longer on.

### 2. pb-review

Invoke `pb-review`. Wait for completion. Read the BLOCKER count from its report.

If `BLOCKER ≥ 1`: stop here. Surface the findings. Do not run verify. Do not prompt for merge.

**Strict-bucket diffs require a completed cross-model review.** If the diff matches the repo's strict risk bucket or its `pb-suite: load-bearing files` globs, a cross-model review must be on record before the gate: a review of this branch diff by a **frontier-tier model from a different family than the one that authored it** (Claude-authored → Codex frontier; Codex-authored → Claude frontier, `claude --model claude-fable-5`), with its findings triaged. No such pass, or a pass run on a mid-tier model → treat as a BLOCKER: run it now (as `pb-implement` step 8b does) before proceeding. Same-model review plus passing tests share the author's blind spots by construction — on strict diffs this pass is the gate, not polish.

Dispatch it in the background and read the result before the gate — these reviews run past ten minutes on a real diff, and trimming the prompt to fit a foreground timeout trades depth for a call that returns.

A pass run on a checklist prompt does not count either. Hand the reviewer the diff and what the change is for, then ask what is wrong with it; enumerating the failure modes to check returns findings in those categories and nothing outside them, which looks like a clean review and is not one. Where to look is fair context, what to find is not.

**OpenCode fallback.** If the preferred Claude/Codex reviewer or frontier model is unavailable, use the `pb-implement` step 8b fallback before declaring the review unavailable: resolve `PB_OPENCODE_REVIEW_MODEL` to an available frontier-tier **GLM or Grok** `provider/model` from a different family than the author, then run `opencode run --agent plan --model "$PB_OPENCODE_REVIEW_MODEL"` on the same branch-diff review prompt. Record the exact resolved model id and triage its findings normally. An unset variable, unavailable model, mid-tier model, same-family model, write-capable `plan` override, or OpenCode default does not satisfy the gate; strict shipping remains blocked.

### 3. e2e-from-pr

Invoke `e2e-from-pr` on the current PR.

The skill writes specs to the project's permanent test locations (`e2e/tests/`, `tests/`, etc.) and runs them. Read its report:

- All items pass → step 3b
- Any item fails → stop, surface the failure, do not prompt for merge

### 3b. Preview e2e (apps exposing `e2e:preview`)

Skip if `--no-preview` is in `$ARGUMENTS`.

For each app affected by the PR diff (monorepo: any `apps/<name>/**` path; single-package repo: the repo root) whose `package.json` defines an `e2e:preview` script:

1. Resolve the PR's preview URL for that app — the deploy platform's branch alias (Vercel: `<project>-git-<branch>-<team>.vercel.app`) or the deploy bot's PR comment. Confirm the deployment is Ready before running.
2. Resolve the protection-bypass secret at run time from the secret manager named in the project's preview-QA rule (this repo's default: 1Password item `vercel-preview-<project>-qa-bypass`, field `VERCEL_AUTOMATION_BYPASS_SECRET`, via `op read`). Never echo the value, never persist it to a file.
3. Run it scoped to the app:

```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" \
VERCEL_AUTOMATION_BYPASS_SECRET="$(op read "op://<vault>/<item>/VERCEL_AUTOMATION_BYPASS_SECRET")" \
pnpm --filter <package> e2e:preview
```

- All runs pass → step 4
- Any run fails → stop, surface the failure (spec name + preview URL), do not prompt for merge
- No affected app defines `e2e:preview` → log "preview e2e: skipped — no e2e:preview script in affected apps" and continue
- Preview deployment errored or absent → treat as a failure, not a skip: a PR whose preview does not build should not reach the merge prompt

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
- Touches a file matched by the canonical `## pb-suite: load-bearing files` block in the project's `CLAUDE.md` (parsed via `pb_load_bearing_paths` in `scripts/lib/cil.sh`).

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

### 6a. Exit-readiness prompt (CIL repos only)

```bash
source "$PB_SUITE/scripts/lib/cil.sh"
```

If `cil_repo_p` AND any changed file under this PR matches an external surface (`cil_external_surface_p`), a load-bearing path (`pb_load_bearing_p`), or `legal/`, `subprocessor`, `privacy`, `billing/`, `auth/`: print the three exit-readiness tests verbatim (reading `CIL/exit-readiness.md` if present) and pause once for the user to acknowledge. Do not gate — this is a forced read, not a decision. One-time per ship.

### 6b. Gate

If `--dry` is in `$ARGUMENTS`: skip to step 8.

Use the `AskUserQuestion` tool with these four options:

- **ship** — squash-merge the PR now
- **wait** — leave the PR open, exit
- **defer** — open a Linear follow-up (via Linear MCP if available, else print the suggested title/body for the user to paste), then exit. Use this for "do later, not strategic"
- **decide** — log a CIL decision first via `/cil-decide`. Use this ONLY when the choice is strategic (multiple plausible outcomes, you might later question A vs B). The command itself enforces that scope — if the only "rejected option" is "don't merge", `cil-decide` will refuse and you should pick **defer** instead

### 7. Action

Based on the user's choice:

- **ship** → invoke the `squash-merge` skill on this PR. The skill handles commit-message crafting, branch cleanup, and the actual merge. Then continue to step 7b.
- **wait** → exit. Print the PR URL.
- **defer** → create a Linear ticket via the Linear MCP (or print a paste-ready draft) with the PR's title, link, and a one-line "deferred at <date>, reason: <user-supplied>" body. Exit.
- **decide** → invoke `cil-decide` with the PR context. After the decision lands, instruct the user to re-run `/pb-ship` when they are ready to ship.

### 7b. Verify it landed (ship path only)

Only after a merge. Skip on `wait`, `defer`, `decide`, and `--dry`. Skip entirely if `--no-follow` is in `$ARGUMENTS`.

A green PR is not a shipped change. Track the exact merge commit through CI, deployment, and — where the repo declares one — a health check. Track the SHA, never the branch: on an active `main`, "the latest run" is routinely somebody else's commit.

```bash
BASE=$(gh pr view --json baseRefName --jq .baseRefName)
git fetch origin "$BASE" --quiet
SHA=$(gh pr view --json mergeCommit --jq '.mergeCommit.oid')
[ -n "$SHA" ] && [ "$SHA" != "null" ] || { echo "pb-ship: no merge commit — the PR did not merge"; }
```

**CI.** The run is not registered the instant the merge lands, so retry before concluding it is missing:

```bash
RUN_ID=""
for _ in 1 2 3 4 5 6; do
  RUN_ID=$(gh run list --branch "$BASE" --limit 20 \
    --json headSha,databaseId --jq ".[] | select(.headSha==\"$SHA\") | .databaseId" | head -1)
  [ -n "$RUN_ID" ] && break
  sleep 5
done
[ -n "$RUN_ID" ] || echo "pb-ship: no CI run found for $SHA after 30s — check whether the workflow triggers on $BASE"
gh run watch "$RUN_ID" --exit-status
```

Handle the three terminal outcomes distinctly:

- **success** → continue to deployment.
- **failure** → report the failing step (`gh run view "$RUN_ID" --log-failed`) and stop. Do not open a fix PR in this run; `/pb-ship` is a gate, not a repair loop. Hand the failure to `/pb-investigate`.
- **cancelled** → a newer push superseded this run, so this commit will never deploy on its own. This is the failure mode that reads as harmless and is not. Confirm the change survives into the newer head and follow that SHA instead:

```bash
NEW=$(git rev-parse "origin/$BASE")
git merge-base --is-ancestor "$SHA" "$NEW" \
  && { echo "pb-ship: run cancelled, change is contained in $NEW — tracking that"; SHA=$NEW; } \
  || echo "pb-ship: run cancelled and $SHA is NOT an ancestor of $NEW — the change is not on $BASE"
```

Then restart the CI block against the new `$SHA`.

**Deployment.** Only for repos that actually deploy — if the query returns nothing, the repo is a library or deploys outside GitHub, and that is a skip, not a failure:

```bash
DEP=$(gh api "repos/:owner/:repo/deployments?sha=$SHA&per_page=1" --jq '.[0].id' 2>/dev/null)
if [ -n "$DEP" ] && [ "$DEP" != "null" ]; then
  gh api "repos/:owner/:repo/deployments/$DEP/statuses" --jq '.[0] | {state, url: .environment_url, log: .target_url}'
fi
```

`pending` or `in_progress` → poll every 10s up to 5 minutes, then report the target URL and stop waiting. `failure` or `error` → the platform build broke after a green CI; report its log URL and stop. Deploy-platform dashboards and CLIs are out of scope here — the link is the handoff.

**Health.** Optional, and only when the repo declares an endpoint. Read a `## pb-suite: health check` line from `CLAUDE.md` (a single URL); if absent, skip silently rather than guessing a path:

```bash
HEALTH=$(sed -n '/^## pb-suite: health check/,/^## /p' CLAUDE.md 2>/dev/null | grep -oE 'https?://[^ )]+' | head -1)
[ -n "$HEALTH" ] && curl -sS -m 15 -o /dev/null -w '%{http_code}\n' "$HEALTH"
```

Non-2xx after a successful deploy usually means the deployed code expects state the environment does not have yet — a migration not applied, an env var not set. Say which, do not attempt to fix production. `/pb-env-check` covers the env-var case.

Never weaken a check to reach green: no re-running until it passes, no `--no-verify` follow-up commit, no merging around a red required check.

### 8. Report

```
pb-ship: <shipped | left-open | deferred | decided | dry-pass | dry-fail | blocked>
  pb-review:   N findings (X BLOCKER, Y IMPORTANT, Z NIT)
  verify:      K test-plan items, all pass (or: M failed)
  preview:     <apps run> pass (or: <app> failed | skipped — no e2e:preview)
  classify:    P persisted, R reverted, A asked
  mode:        smart | regress | no-regress
  PR:          <url>
  landed:      CI <pass | fail | cancelled-superseded> / deploy <success | failed | none> / health <2xx | non-2xx | none>
               sha <merge commit>
```

The `landed` line appears only on the ship path. Omit it entirely otherwise.

End with one sentence on what the next action is, if any. No emojis, no exclamation marks.
