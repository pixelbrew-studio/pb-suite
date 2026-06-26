---
description: Read learning artifacts written by pb-check and pb-investigate, cluster recurring patterns across PRs, and propose surgical edits to pb-* skills. Never auto-applies — every candidate goes through explicit confirmation. The suite evolves from real signal, not vibes.
allowed-tools: [Bash, Read, Edit, Glob, Grep, AskUserQuestion]
argument-hint: "[--global] [--cil] [--since=Nd] [--skill=pb-name] [--apply]"
---

# pb-evolve

Reads `.claude/lessons.md` (written by `/pb-check`) and `.claude/incidents.md` (appended by `/pb-investigate`), clusters recurring patterns, and proposes surgical edits to the relevant pb-* skill files. Report-only by default; `--apply` writes one edit at a time after per-candidate confirmation.

This is the only pb-suite skill that edits the suite itself. It refuses to run on a dirty `PB_SUITE` working tree (would mix evolve edits with unrelated WIP) and excludes its own file from the candidate-skill set.

The suite's "no telemetry" principle stands — pb-evolve never writes a log. It only reads opt-in artifacts that two other pb-* skills already produce when the user runs them.

## Modes

- **default** — scan, cluster, propose, no writes
- **--apply** — per-candidate `AskUserQuestion` before each edit
- **--global** — scan `$PB_PROJECTS_DIR` (default `~/Pixelbrew/Projects/Active`), walk one level deep (same convention as `/pb-across`)
- **--cil** — in addition to `.claude/lessons.md` + `.claude/incidents.md`, ingest `CIL/improvements/*.md` and `CIL/incidents.md` if present. Auto-enabled when `cil_repo_p` (top-level `CIL/sources.md` exists) — pass `--cil=off` to suppress
- **--since=Nd** — limit entries to the last N days (default 90)
- **--skill=pb-name** — only propose edits to that skill

## Steps

### 1. Preflight

```bash
source "$HOME/.claude/commands/pb-bootstrap.sh"
if [ -n "$(cd "$PB_SUITE" && git status --porcelain)" ]; then
  echo "pb-evolve: PB_SUITE has uncommitted changes — refuse. Commit or stash in $PB_SUITE first."
  exit 1
fi
```

Parse `$ARGUMENTS`: `--global`, `--since=Nd`, `--skill=pb-name`, `--apply`. Defaults: local scan, 90 days, all skills, report-only.

### 2. Locate learning artifacts

Local (default): `./.claude/lessons.md` and `./.claude/incidents.md` in the current repo.

CIL-augmented (`--cil` or auto when `cil_repo_p`): also read `./CIL/improvements/*.md` (treat each file as one cluster signal — its title becomes the topic, body becomes one lesson-equivalent entry) and `./CIL/incidents.md` if present. Source these in addition to the `.claude/*.md` artifacts; do not deduplicate, but mark the source in step 6 output (`[CIL]` prefix on samples).

Global (`--global`):

```bash
ROOT="${PB_PROJECTS_DIR:-$HOME/Pixelbrew/Projects/Active}"
[ -d "$ROOT" ] || { echo "pb-evolve: $ROOT not found"; exit 1; }
find "$ROOT" -maxdepth 3 -type f \( -name lessons.md -o -name incidents.md \) -path '*/.claude/*'
```

If no artifacts exist anywhere in scope: report cleanly and exit. Not an error — means the user hasn't run `/pb-check` or `/pb-investigate` enough yet, or hasn't opted into `.claude/incidents.md`.

### 3. Parse entries

`lessons.md` blocks (per `/pb-check` step 9 format):

```
## YYYY-MM-DD — <branch>
<paragraph-form lessons content, 1-3 observations + takeaways>

---
```

Parse each `##` block as one entry. Extract date, repo (from path), branch, body. Within the body, capture explicit `pb-*` mentions, file paths, and topic keywords.

`incidents.md` lines (per `/pb-investigate` step 10):

```
YYYY-MM-DD <branch>  <area> — <root cause in one phrase>
```

One per line. Parse date, repo, branch, area, root cause.

Filter both streams by `--since`. Drop entries older than the window.

### 4. Cluster

Group entries by topic. A cluster qualifies for an edit proposal at **n ≥ 3** entries.

Signal weight (in order):

- Explicit `pb-*` skill mention in the lesson body — assigns the cluster to that skill
- Topic keyword (`auth`, `RLS`, `hydration`, `hex literal`, `webhook signature`, `idempotency`, `AI-slop`, `race condition`, `redirect`, `PII`, `retention`) — maps to a default candidate skill via the table below
- File-path token (`middleware`, `proxy.ts`, `*.spec.ts`) — adds weight to clusters mentioning the same path across entries
- `incidents.md` area field — direct match

Default keyword → skill mapping:

| keyword family | candidate skill |
|---|---|
| auth, RLS, session, webhook signature, idempotency, redirect, SSRF | `pb-cso` (and `pb-review` Safety) |
| hex literal, hardcoded color, hierarchy, hydration, a11y, AI-slop visual | `pb-design-review` |
| missing test, swallowed error, race condition, off-by-one | `pb-review` |
| broken import, stale spec, all-skipped | `pb-prune-tests` |
| trope word, AI-slop phrasing, exclamation, emoji-in-copy, brand-tone | `pb-copy` (AI-slop rules in `references/ai-writing-signals.md`) |
| missing schema, semantic-term gap, thin content, keyword placement, E-E-A-T, AI-citability | `pb-pop` (rules in `references/seo-signals.md`) |
| env drift, prod-only, leaked secret in example | `pb-env-check` |
| PII, retention, ZDR, lawful basis | `pb-audit`, `pb-tdd` (strict bucket) |

### 5. Propose edits

For each cluster, propose **one** surgical edit to the candidate skill. Allowed edit shapes:

- **add** — new bullet under an existing checklist section
- **remove** — a check whose false-positive rate is high (lessons explicitly contradict it n ≥ 3)
- **re-tier** — move a check between BLOCKER / IMPORTANT / NIT

A candidate may target a knowledge-base file the skill reads at runtime rather
than the skill body — for `pb-pop`, that is `references/seo-signals.md` (adjust a
weight, add a signal, re-band a threshold, extend the schema catalog). When you
edit a `references/*.md` file, append a dated bullet to its own changelog
section so the change stays traceable.

Never:

- Rewrite a section wholesale
- Touch frontmatter, the severity-model definitions, or step structure
- Edit `pb-evolve.md`, `scripts/lib/bootstrap.sh`, or `scripts/lib/scope.sh`
- Bundle two unrelated edits in one proposal

For each proposal, capture: target file, line range, before, after, n, 2-3 sample quotes (date + repo + one-line excerpt).

### 6. Report (report-only mode ends here)

```
pb-evolve: <C candidates from L lessons + I incidents across R repos>
Window: --since=<N>d  Scope: <local | global>

[strong signal: n>=5]
  candidate-1: pb-cso  step 6, after "A05 Security Misconfiguration"
    add: "Webhook idempotency key logged unredacted in error path" (n=6)
    sample: 2026-04-12 (Sendays) — "stripe webhook handler dumped event.id into breadcrumb"
            2026-05-02 (Acme) — "auth replay-token leaked in 500 response body"
            ...

[medium signal: n=3-4]
  candidate-2: pb-design-review  color section
    re-tier: "Pure greys without hue" NIT -> IMPORTANT (n=4)
    sample: ...

[noted, no edit proposed]
  topic "race condition" (n=3) — already covered by pb-review step 3 Correctness
```

If a cluster has signal but the relevant rule already exists in the candidate skill, list it under "noted, no edit proposed" with a one-line reason. Do not propose duplicates.

### 7. Apply (`--apply` only)

For each candidate in order, use `AskUserQuestion` with three options:

- **apply** — write the edit, continue
- **skip** — leave the skill unchanged, continue
- **discuss** — print full source quotes for the cluster, then prompt for free-form direction

After all candidates handled, if any edit was applied:

- Bump `VERSION` patch (e.g. `0.1.3` → `0.1.4`)
- Print: "pb-evolve: applied K edits. Review `git diff` in $PB_SUITE, then commit."

Never commit. The user reviews diff and commits with their own message.

### 8. Final report

```
pb-evolve: <C> proposed | <K> applied | <S> skipped | <D> discussed
Source:  <L> lessons + <I> incidents over <D> days, <R> repos
Skills:  <pb-cso, pb-design-review, ...>
VERSION: <old> -> <new> (or "unchanged")

Next: cd $PB_SUITE && git diff   # review the edits before committing
```

End with one sentence on what to look for in the diff.

## What this command does NOT do

- Not telemetry — only reads files the user opted into by running `pb-check` or maintaining `.claude/incidents.md`
- Not auto-apply — every edit goes through `AskUserQuestion`
- Not skill-rewrite — surgical add / remove / re-tier only
- Not commit — leaves edits in the `PB_SUITE` working tree
- Not self-modifying — `pb-evolve.md` is excluded from candidate skills
- Not a substitute for judgment — the user accepts or rejects each proposal; the heuristics surface candidates, not verdicts
