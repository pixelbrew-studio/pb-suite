---
description: Opt a project into pb-suite — add gitignore entries for pb-* output dirs, optionally create .claude/lessons.md and .claude/incidents.md, scaffold a CLAUDE.md skeleton if missing. Per-item AskUserQuestion. Idempotent.
allowed-tools: [Bash, Read, Edit, Write, AskUserQuestion]
argument-hint: "[--minimal]  skip CLAUDE.md scaffold offer"
---

# pb-init

Bootstrap a project for pb-suite. Detects what is missing and offers to add each piece. Every change is per-item opt-in via `AskUserQuestion` — never bulk, never silent.

Idempotent. Safe to re-run; it only proposes what is actually missing.

## Steps

### 1. Preflight

```bash
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "pb-init: not a git repo"; exit 1; }
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
```

If the current directory is the pb-suite repo itself, refuse:

```bash
[ -f VERSION ] && [ -d commands ] && head -1 README.md 2>/dev/null | grep -q '^# pb-suite' && {
  echo "pb-init: this is pb-suite itself, not a target project. Run pb-init from inside a downstream repo."
  exit 1
}
```

### 2. Inventory what is missing

Check each of the following. Skip items that are already in place.

| Item | Present if... |
|---|---|
| `.gitignore` has `.pb-qa/` | grep -q '^\.pb-qa/' .gitignore |
| `.gitignore` has `.pb-design-review/` | grep -q '^\.pb-design-review/' .gitignore |
| `.gitignore` has `.pb-browse/` | grep -q '^\.pb-browse/' .gitignore |
| `.gitignore` has `.pb-roast/` | grep -q '^\.pb-roast/' .gitignore |
| `.claude/lessons.md` exists | test -f .claude/lessons.md |
| `.claude/incidents.md` exists | test -f .claude/incidents.md |
| `CLAUDE.md` exists | test -f CLAUDE.md |

Report the inventory as a checklist before asking anything:

```
pb-init: $ROOT
  .gitignore: .pb-qa/             [present | missing]
  .gitignore: .pb-design-review/  [present | missing]
  .gitignore: .pb-browse/         [present | missing]
  .gitignore: .pb-roast/          [present | missing]
  .claude/lessons.md              [present | missing]
  .claude/incidents.md            [present | missing]
  CLAUDE.md                       [present | missing]
```

If everything is present: report "all set, nothing to do" and exit.

### 3. Gitignore entries

For each missing gitignore entry, ask via `AskUserQuestion`:

> Add `.pb-qa/` to `.gitignore`? Holds runtime QA screenshots — should never be committed.

Options: **add** / **skip**.

On add: append the entry (create `.gitignore` if it doesn't exist). Bundle multiple yes-answers into one append at the end, separated by `# pb-suite output dirs` comment.

### 4. Learning artifacts

For each missing `.claude/<file>.md`, ask via `AskUserQuestion`:

> Create `.claude/lessons.md`? `/pb-check` will append cross-PR patterns here when it runs. `/pb-evolve` reads it later to propose tweaks to pb-* skills. Empty file = opted in; absent = opt out.

Options: **create** / **skip**.

On create, write the file with a one-line header. Lessons:

```markdown
# Lessons — <repo name>

<!-- Appended by /pb-check after each comprehensive audit. Cross-PR patterns,
     not single findings. Read by /pb-evolve for suite-tuning. -->
```

Incidents:

```markdown
# Incidents — <repo name>

<!-- Appended by /pb-investigate after each resolved root cause. One line per
     incident: "YYYY-MM-DD <branch>  <area> — <root cause>". Read by /pb-evolve. -->
```

Also ensure `.claude/` itself is not in `.gitignore` — these files only have value if they are committed (they need to survive across machines and contributors).

### 5. CLAUDE.md scaffold (skip with `--minimal`)

If `CLAUDE.md` is missing and `--minimal` is not in `$ARGUMENTS`, ask via `AskUserQuestion`:

> No `CLAUDE.md` found. Scaffold a minimal one with sections for brand-tone, testing policy, load-bearing files, and pb-suite conventions? You can edit before saving.

Options: **scaffold** / **skip**.

On scaffold, write `CLAUDE.md` with this skeleton — show it to the user first, ask for final approval before writing:

```markdown
# CLAUDE.md

Project-specific guidance for AI coding agents. pb-suite skills read this file
for brand-tone, testing policy, and load-bearing files.

## Brand tone

- Language: <NL | EN | mixed — specify per surface>
- Emoji: <forbidden | allowed>
- Exclamation marks: <forbidden | allowed>
- Superlatives to avoid: <list, or "none">
- Required vocabulary: <product names, preferred phrasings>
- Avoided vocabulary: <generic terms, deprecated names>

## Testing policy

<Run `/pb-tdd --init-policy` to append the canonical template here.>

## Load-bearing files

Files whose changes require `/pb-ship`'s cross-family review. List paths or globs:

- <e.g. src/lib/billing/**>
- <e.g. src/lib/auth/middleware.ts>

<!-- Run /pb-rules to inject the pb-suite Workflow block (trigger table, risk
     buckets, severity model). pb-rules is the canonical source — re-run it to
     pick up suite updates. -->
```

Do not pre-fill the placeholders. The user fills them in after pb-init exits.

### 6. Report

```
pb-init: <repo>
  Added:
    - .gitignore: .pb-qa/, .pb-design-review/, .pb-browse/, .pb-roast/
    - .claude/lessons.md
    - .claude/incidents.md
    - CLAUDE.md (scaffold)
  Skipped (already present):
    - <list>
  Skipped (user declined):
    - <list>

Next: fill in CLAUDE.md placeholders, run `/pb-rules` to inject the pb-suite Workflow block, then `/pb-check` on your next PR.
```

End with one sentence — what the user should do next. Do not commit; the user reviews `git status` and commits with their own message.

## What this command does NOT do

- Not a project initializer — does not run `git init`, install dependencies, or scaffold framework files. Use the framework's own tooling for that.
- Not a `CLAUDE.md` enforcer — it scaffolds, the user fills it in.
- Not auto-commit — produces working-tree changes only.
- Not interactive beyond `AskUserQuestion` — does not run an editor inline.
