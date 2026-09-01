---
description: Inject or update the pb-suite Workflow block in a CLAUDE.md file. Per-repo by default; --global writes to ~/.claude/CLAUDE.md. Single canonical source — re-run after suite updates to pick up changes. Idempotent; diffs before overwriting.
allowed-tools: [Bash, Read, Edit, Write, AskUserQuestion]
argument-hint: "[--global]  write to ~/.claude/CLAUDE.md instead of project CLAUDE.md"
---

# pb-rules

Inject the canonical pb-suite Workflow block (trigger table, risk buckets, severity model, default test stack) into a `CLAUDE.md` file. The block tells Claude which pb-* command to run for each kind of change.

Idempotent. If a `## Workflow (pb-suite)` heading already exists, pb-rules diffs the canonical block against what's there and asks before overwriting.

## Steps

### 1. Locate target

```bash
if echo "$ARGUMENTS" | grep -q -- "--global"; then
  TARGET="$HOME/.claude/CLAUDE.md"
  MODE="global"
else
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
    echo "pb-rules: not a git repo and no --global flag — nothing to target"; exit 1; }
  TARGET="$(git rev-parse --show-toplevel)/CLAUDE.md"
  MODE="repo"
fi
```

Refuse if running inside pb-suite itself in per-repo mode:

```bash
if [ "$MODE" = "repo" ]; then
  [ -f VERSION ] && [ -d commands ] && head -1 README.md 2>/dev/null | grep -q '^# pb-suite' && {
    echo "pb-rules: this is pb-suite itself. Use --global, or run from a downstream repo."
    exit 1
  }
fi
```

If `$TARGET` does not exist:

- **repo mode** → stop and tell the user: "Run `/pb-init` first to scaffold CLAUDE.md, then re-run `/pb-rules`."
- **global mode** → ask via `AskUserQuestion`: create new `~/.claude/CLAUDE.md` containing only the block, or cancel.

### 2. Detect existing block

```bash
grep -n "^## Workflow (pb-suite)" "$TARGET"
```

Three cases:

- **absent** → step 4 will append at end-of-file.
- **present and identical** to the canonical block below → report "already up to date" and exit cleanly.
- **present and differs** → use `AskUserQuestion`: **replace** (overwrite with canonical), **keep** (leave file untouched), **show-diff** (print the diff and re-ask).

### 3. Canonical block

This is the single source of truth. Inject this verbatim into the target file.

````md
## Workflow (pb-suite)

Triggers — apply unless the user explicitly opts out:

| When | Run |
|---|---|
| Tiny deterministic fix (one behavior, clear test) | `/pb-tdd <slice>` |
| Nontrivial feature or refactor | `/pb-implement <objective>` — it plans verification and routes TDD, investigation, and specialist review by what the change touches |
| Strict path (AI request, billing/credits, auth/tenant, storage/retention, secrets) | strict `/pb-implement` — human gate + mandatory cross-model review |
| Touching files under `src/lib/ai/`, `src/lib/billing/`, `src/lib/auth/` | `/pb-cso --diff` before opening a PR |
| Touching UI files (`.tsx`, `.css`, tailwind config) | `/pb-design-review` before opening a PR |
| Touching `marketing/`, `landing/`, user-facing copy | `/pb-copy --mode rewrite` before opening a PR |
| Need an outside voice on a website, file, dir, diff, PR, or pitch | `/pb-roast <target>` — cross-model roast via OpenCode (Grok default) |
| Touching `marketing/`, `landing/`, or SEO pages (discoverability, not just tone) | `/pb-pop <url\|file>` before opening a PR — score for search / AI citability |
| Debugging a reproducible bug | `/pb-investigate` before editing — no fix without root cause |
| Drafting a PR | `/pb-pr` (refuse `--no-verify` and `--force`) |
| Pre-merge | `/pb-ship` (refuse the merge if BLOCKERs remain) |
| Live QA of a deploy | `/pb-qa <url>` for evidence, then `/pb-investigate` for cause |
| Fetching URL content | `/pb-browse <url>` instead of WebFetch |
| Branch name encodes a tracker key (e.g. `ABC-123-foo`) | `/pb-pr` will seed the summary from the ticket and append `Closes <KEY>` |

Risk buckets — strict means TDD required, full edge-case broadening:

- **strict**: AI request construction (incl. ZDR/PII shaping), billing/credits/idempotency, auth and org/tenant scoping, document upload/deletion/retention, pseudonymization, evidence anchoring, scoring/evaluation, analytics PII, legal/subprocessor routes, secrets handling
- **light**: standard CRUD on non-sensitive entities, internal admin tools, dev-experience tweaks
- **skip**: docs, comments, dependency bumps without runtime impact, pure visual copy/layout, type-only changes

Severity model is suite-wide:

- **BLOCKER** — auto-fix when the change is local and obvious; otherwise list
- **IMPORTANT** — ask before fixing (taste call, completeness gap)
- **NIT** — mention once, do not fix unless asked

Default test stack: Vitest (unit/integration), Playwright (e2e). No new test framework without an actual first test.

Learning artifacts (opt-in, committed):

- `.claude/lessons.md` — `/pb-check` appends cross-PR patterns here
- `.claude/incidents.md` — `/pb-investigate` appends one-line root causes here
- `/pb-evolve` reads both and proposes suite edits at n ≥ 3
- In a CIL repo (top-level `CIL/sources.md` present), `/pb-evolve --cil` additionally reads `CIL/improvements/*.md` and routes incidents to `CIL/incidents.md` instead of `.claude/incidents.md`.

## pb-suite: load-bearing files

Canonical block consumed by `/pb-ship` (strict cross-family review) and `/pb-cso` (severity heightening). One glob per bullet. Match semantics: shell glob against repo-relative path.

```
- src/lib/billing/**
- src/lib/auth/**
- packages/*/billing/**
```

If absent, `pb-ship` uses the canonical strict risk bucket. Add the block for project-specific load-bearing paths.

## pb-suite: next-step nudges

End each reply with one line `Next: /<command> — <reason in <=8 words>` when a pb-suite or CIL command logically follows. Skip the line when:

- The reply is purely conversational (explanation, question back, opinion without code impact).
- The reply already names a pb-/cil-command inline.
- We're mid-flow inside `/pb-investigate`, `/pb-tdd`, or `/cil-decide` (the skill drives the next step).

Decision tree — first match wins:

1. Code/copy just changed, nothing reviewed → `/pb-check` (or `/pb-review` alone).
2. Diff touches `marketing|landing|privacy|legal|subprocessor` → `/pb-cso --diff`.
3. Diff touches `.tsx|.css|tailwind` without review → `/pb-design-review`.
4. Branch has commits, no PR → `/pb-pr`.
5. PR open, CI green, no BLOCKERs → `/pb-ship`.
6. Bug reproduced without root cause → `/pb-investigate`.
7. New behavior planned → `/pb-implement <objective>` for a nontrivial feature/refactor; `/pb-tdd <slice>` for a tiny deterministic fix.
8. Strategic choice with multiple plausible outcomes in this reply → `/cil-decide` (CIL repo only).
9. "Where was I?" / context recovery → `/pb-resume`.
10. Plan-vs-build gap suspected across sources → `/cil-pulse` (CIL repo only).

Style: one line, no emoji, no code block, no "(Recommended)". Reason is concrete — "load-bearing diff, security pass" beats "for safety".

<!-- Injected by /pb-rules. Re-run /pb-rules to pick up suite updates. -->
````

### 4. Apply

**Append** (block absent): write a single blank line at end-of-file if the file does not already end with one, then write the canonical block.

**Replace** (block present, user chose replace): locate the line of `^## Workflow (pb-suite)` and the next `^## ` heading (or end-of-file). Replace that range with the canonical block.

Use `Edit` or `Write` — never inline `sed`. Working tree changes only; do not commit.

### 5. Report

```
pb-rules: <appended | replaced | up-to-date | declined>
  Target:  <path>
  Mode:    repo | global

Next: review with `git diff <target>` (or `cat <target>` for --global, which is not in a repo).
```

If `--global` and the user wants the block to also land in every existing project: suggest `/pb-across /pb-rules` as the follow-up.

## What this command does NOT do

- Not a CLAUDE.md scaffolder — that is `/pb-init`. pb-rules expects the file to exist (or `--global` mode).
- Not a per-repo rule writer — the block is suite-wide. Project-specific tweaks live elsewhere in the same CLAUDE.md (brand-tone, load-bearing files, custom risk buckets).
- Not auto-commit — leaves the change in the working tree.
