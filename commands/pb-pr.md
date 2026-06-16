---
description: Draft a PR description from the current branch diff. Reads CLAUDE.md for brand-tone (no emoji, concise, why-not-what), infers intent from diff + commits, fills the project's PR template if present. Drafts → user reviews → optional gh pr create.
allowed-tools: [Bash, Read, AskUserQuestion]
argument-hint: "[--draft]  open PR as draft  | [--no-open]  draft only, do not call gh"
---

# pb-pr

Draft a PR description for the current branch. Reads `CLAUDE.md` for brand-tone rules, scans the diff + commit messages for intent, fills the project's `.github/pull_request_template.md` if it exists, and shows the draft before opening anything.

The merge itself is `/pb-ship`. This command only handles the description.

## Steps

### 1. Preflight

```bash
source "$HOME/.claude/commands/pb-bootstrap.sh"
source "$PB_SUITE/scripts/lib/scope.sh"

BRANCH=$(git branch --show-current)
case "$BRANCH" in main|master) echo "pb-pr: on $BRANCH, switch to a feature branch first"; exit 1;; esac

EXISTING=$(gh pr view --json number,url 2>/dev/null)
if [ -n "$EXISTING" ]; then
  echo "pb-pr: a PR already exists for this branch:"
  echo "$EXISTING"
  echo "Use 'gh pr edit' to update the description manually, or close it first."
  exit 1
fi
```

Refuse hook-skipping flags up front:

```bash
case " $ARGUMENTS " in
  *" --no-verify "*|*" --force "*|*" -f "*)
    echo "pb-pr: refuse — bypass flag detected."; exit 1;;
esac
```

### 2. Gather signal

```bash
git log --oneline "$BASE"..HEAD                                   # commit messages on this branch
git diff --stat "$BASE"...HEAD                                    # what files changed
git diff "$BASE"...HEAD                                           # the actual diff (full read)
```

If inside a CIL repo (or any repo where the branch encodes a tracker key), try to extract the ticket:

```bash
source "$PB_SUITE/scripts/lib/cil.sh"
TICKET=$(cil_linear_ticket_from_branch "$BRANCH")
```

When `$TICKET` is non-empty: fetch the ticket title + one-line description via the Linear MCP if available (any tool whose name contains `linear`). Use this to seed the PR summary's "why" line and add a `Closes <TICKET>` footer (Linear auto-links on PR open). On MCP failure or no key found: continue without it — never block on tracker fetch.

Read in this order — commits first (they state intent), stat second (scope), full diff third (what actually changed).

If commits are mostly auto-checkpoints or WIP messages without substance: rely on the diff. If the diff is small (<50 lines), read it fully. If large, focus on new functions, route handlers, type definitions, and any file with >20 lines changed.

### 3. Read brand-tone and PR template

```bash
[ -f CLAUDE.md ] && head -100 CLAUDE.md
[ -f .github/pull_request_template.md ] && cat .github/pull_request_template.md
[ -f .github/PULL_REQUEST_TEMPLATE.md ] && cat .github/PULL_REQUEST_TEMPLATE.md
```

Brand-tone rules to apply from `CLAUDE.md` (also default to these when no `CLAUDE.md`):

- No emoji
- No exclamation marks
- No AI-slop trope words (see `/pb-copy` appendix — leverage, dive into, robust, seamless, etc.)
- Concise: title under 70 chars, summary in 1-3 bullets, "why" not "what"
- One-shot operation, no future-tense ("will add X" → "adds X")

If a PR template exists, use its sections verbatim. Otherwise use the suite default below.

### 4. Infer intent

Categorize the change as exactly one of:

- **fix** — corrects a bug (commit messages mention "fix", diff is small/targeted, may add a test)
- **feature** — adds new behavior (new routes, new components, new tests for new code)
- **refactor** — restructures without behavior change (no new tests, equivalent assertions, file moves)
- **chore** — deps, configs, docs (no `src/` substantive changes, or only `.md` / config files)
- **mixed** — two or more of the above. Surface this; mixed PRs are a smell.

If **mixed**: pause and ask via `AskUserQuestion`:

> This branch mixes <fix + feature | refactor + feature | ...>. Continue with one description, or split first? Splitting before describing usually produces tighter PRs.

Options: **continue** / **suggest-split** / **cancel**.

### 5. Draft

Default suite format when no project template exists:

```
<one-line title — under 70 chars, present-tense verb, no period>

## Summary

- <bullet 1 — why this change, the underlying need>
- <bullet 2 — what it changes in one phrase>
- <bullet 3 — anything subtle (perf, security, behavior shift), if applicable>

## Test plan

- [ ] <automatable check — unit test, e2e, lint, build>
- [ ] <manual check — what to click, what to verify visually>
- [ ] <regression check — what should still work>

<!-- when $TICKET set -->
Closes <TICKET>
```

Rules for filling each section:

- **Title**: verb + object. "fix race in upload worker" beats "Update upload-worker.ts". No emoji, no PR-number prefix, no Conventional Commits unless the project already uses them.
- **Summary**: 1-3 bullets. Each bullet starts with a verb in present tense. Mention the *why* — not just "adds X" but "adds X to unblock Y". If there is no why, the bullet is filler and gets dropped.
- **Test plan**: pull from any explicit test changes in the diff (new `*.test.ts`, new `*.spec.ts`). For UI flows, suggest a manual click-path. For backend, suggest the curl or test command. If the diff is `chore`, the test plan is `- [ ] CI passes`.

If a project template exists, fill its sections and skip any that do not apply (write `_n/a_` rather than dropping the heading).

### 6. Show and confirm

Print the draft in a fenced block, exactly as it would be sent. Then `AskUserQuestion`:

- **open** — call `gh pr create` with this draft
- **draft** — same as open, but with `--draft`
- **revise** — accept free-form feedback, regenerate
- **copy** — print the draft and exit (user opens the PR manually)
- **cancel** — exit, nothing happens

### 7. Open (only on `open` or `draft`)

```bash
gh pr create \
  --title "$TITLE" \
  --body "$BODY" \
  ${DRAFT:+--draft}
```

Pass the title and body via heredoc to preserve formatting. Do not pass `--no-verify` or any hook-skipping flag.

If `gh` is not authenticated or the repo has no GitHub remote, surface the error and print the draft so the user can paste it manually.

### 8. Report

```
pb-pr: <opened | draft | copied | cancelled>
  Branch:   <branch>
  Base:     <base ref>
  Intent:   <fix | feature | refactor | chore | mixed>
  Title:    <title>
  PR URL:   <url or "not opened">

Next: /pb-review (if not done), then /pb-ship.
```

End with one sentence on what to do next.

## What this command does NOT do

- Not a merger — `/pb-ship` handles the gate, `squash-merge` handles the merge.
- Not a reviewer — does not run `/pb-review` automatically. If the user has not reviewed, this command does not block, but the report suggests it.
- Not auto-revise — `revise` mode regenerates once with the user's feedback; the user can call `/pb-pr` again for a second pass.
- Not a multi-PR tool — one branch, one PR. For stacked PRs, use `gh` directly.
