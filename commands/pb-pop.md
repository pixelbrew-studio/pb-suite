---
description: PageOptimizer-Pro-style SEO / AI-citability audit. Scores a page 0-100 against the signals AI answer-engines and Google reward — keyword placement, schema, semantic terms, structure, E-E-A-T, depth — benchmarked against the pages currently ranking for the target query. Report-only; rewrites hand off to /pb-copy.
allowed-tools: [Bash, Read, Glob, Grep, WebSearch, AskUserQuestion]
argument-hint: "<url | file> [--query \"target keyword\"] [--blueprint] [--no-benchmark] [--cite-check]"
---

# pb-pop

Score a page for search and AI-answer-engine discoverability, the way
PageOptimizer Pro does: not a fixed checklist but a benchmark against the pages
currently ranking for your target query. Same severity model as the rest of the
suite — BLOCKER for a missing critical signal, IMPORTANT for partial coverage,
NIT for minor. Report-only: `/pb-pop` scores and instructs; rewrites go to
`/pb-copy`.

This is the third review axis. `/pb-copy` reviews the words, `/pb-design-review`
reviews the UI, `/pb-pop` reviews whether the page is engineered to be found and
cited. The thesis: most content is invisible to AI not because it is badly
written but because the technical signals are absent.

## Modes

- **audit** (default) — score an existing page (URL or local file).
- **blueprint** (`--blueprint`) — for a not-yet-written page: emit a
  heading/schema/term/word-count spec engineered to publish near 100.
- **cite-check** (`--cite-check`) — additionally measure the real KPI: query the
  target question against AI search and check whether the page's domain is cited
  today (see step 3b). The proxy score predicts citability; this measures it.

## Steps

### 0. Load the knowledge base

Resolve the suite and read the scoring rules. This file — not this skill body —
is the source of categories, weights, bands, schema catalog and sector rules.

```bash
source "$HOME/.claude/commands/pb-bootstrap.sh"
KB="$PB_SUITE/references/seo-signals.md"
[ -f "$KB" ] || { echo "pb-pop: knowledge base missing at $KB — run $PB_SUITE/install"; exit 1; }
```

`Read` `$KB`. Use its weights and band thresholds in steps 4-5; do not hardcode
scoring constants here.

### 1. Triage `$ARGUMENTS`

Parse: a positional `<url | file>`, `--query "..."`, `--blueprint`,
`--no-benchmark`.

- **URL** (`http(s)://`) or **local `.html`** → extract signals with `pop.ts`:

  ```bash
  PB_SCRIPT="$PB_SUITE/scripts/pop.ts"
  [ -f "$PB_SCRIPT" ] || { echo "pb-pop: $PB_SCRIPT missing — run $PB_SUITE/install"; exit 1; }
  bun "$PB_SCRIPT" "$TARGET"
  ```

  Capture the JSON (`title`, `metaDescription`, `jsonLd`, `headings`,
  `sections` (heading → opening passage, for extractability), `wordCount`,
  structure counts, `images`, `links`, and `aiAccess` (robots.txt / llms.txt AI
  bot status)). On non-zero exit, surface stderr and stop.
- **Local `.mdx` / `.tsx`** → `Read` the file and extract the same signals
  directly (headings, JSON-LD blocks, word count, alt/anchor text). No script —
  source files do not render meaningfully under a browser.
- **`--blueprint` with no page** → skip extraction, go to step 6.

Determine the **target query**: `--query` if given, else infer from the `<h1>` /
`<title>`, else ask via `AskUserQuestion`. The query is the axis everything is
scored against — do not guess silently on a commercial page.

### 2. Read project context

Read `CLAUDE.md` (and the app-level `CLAUDE.md` if inside a monorepo app) for a
`## SEO` / `## pb-pop` block and the business **sector** — the same multi-source
read `/pb-copy` does. The block's recognized keys (sector, target queries, house
schema, entity, notes) are documented in the knowledge base; project keys win
over the KB defaults. Sector drives E-E-A-T strictness (legal / health / finance
/ local = strict baseline). If sector is undocumented, infer it from the page and
state the assumption in the report.

### 2b. House reviewer lens

Load `$PB_SUITE/references/house-review-lens.md` (if present) and apply the parts that bear on page value: vanity / context-free aggregates (HR-01), escape routes / stranding (HR-04), and not-self-contained content (HR-09). Add matching findings under a **House reviewer** heading. Honour the Part D calibration. A project may extend or override it with a `## House reviewer` block in `CLAUDE.md`.

### 3. Competitor benchmark (default; skip with `--no-benchmark`)

POP's defining trait — the score is relative, not absolute.

1. `WebSearch` the target query. Take the top ~5 genuinely-ranking result URLs
   (skip aggregators/ads if obvious).
2. Run `pop.ts` on each competitor URL.
3. Aggregate: **median word count**, the **set of schema `@type`s** competitors
   use for this page kind, and the **recurring semantic terms / entities** that
   appear across them (including in their headings and anchor text).

State the competitor set explicitly in the report so the calibration is not a
black box. With `--no-benchmark`, skip this and score against the absolute
defaults in the knowledge base — and say so (the score becomes a checklist, not
competitor-calibrated).

### 3b. Citation reality check (`--cite-check` only)

Measure the actual KPI, not just the proxy. For the target query, `WebSearch`
the user's question phrased naturally and inspect which sources an AI answer
cites; check whether the page's own domain appears.

- **Cited** — the goal. Note the engine and the competing sources cited alongside.
- **Not cited, competitor is** — a real, measured gap. Per the KB, this escalates
  any IMPORTANT structural/schema finding toward BLOCKER — it is no longer
  hypothetical.
- **No AI answer / nobody cited** — note it and fall back to the proxy score.

### 4. Score

**AI-access gate first.** Before scoring, check `aiAccess.blocked`. Any AI bot
listed there is a **BLOCKER reported above the score** — a blocked crawler means
the page cannot be cited by that engine regardless of on-page quality. Name the
engine each blocked bot feeds (Google-Extended → AI Overviews/Gemini,
OAI-SearchBot → ChatGPT search, PerplexityBot → Perplexity). `aiAccess.llmsTxt`
false is a NIT.

Then score each knowledge-base category as a fraction of its weight, calibrated
to step 3 where a benchmark ran:

- **Keyword placement** — target query in `<title>` and the single `<h1>`.
- **Schema** — JSON-LD present, covering the page-appropriate `@type`s (catalog
  in the KB, intersected with what competitors use), AND valid (required props,
  correct nesting) — score an invalid block as absent.
- **Semantic terms** — entity coverage in body AND in `alt` / anchor text vs the
  recurring competitor terms.
- **Structure** — lists / FAQ / tables present, no walls of text.
- **Passage extractability** — from `sections[]`: does each section open with a
  direct, self-contained, factual answer an LLM can lift? Score branding/CTA/empty
  openers low (KB has the rubric). This is the unit of AI citation.
- **Internal links** — descriptive-anchor internal links to related content.
- **Content depth** — within ~20% of the competitor median (or sector norm).
- **E-E-A-T** — author / org / expert schema and credentials, at the strictness
  the sector demands.

Sum to a 0-100 score and map to a band (Critical / Weak / On the way / Strong)
using the KB thresholds. If on-page is strong but `--cite-check` found you
uncited, add the KB's off-page/entity note — do not let a high score read as
"done".

### 5. Map findings to severity

- **BLOCKER** — a blocked AI crawler (top priority), no schema at all,
  `<h1>`/`<title>` missing the query, content >20% shorter than the competitor
  median, or a missing trust signal in a strict-sector page. A `--cite-check`
  "not cited while a competitor is" promotes the responsible structural/schema
  finding to BLOCKER.
- **IMPORTANT** — partial coverage: some-but-not-all expected schema types, thin
  semantic-term coverage, walls of text, weak internal linking.
- **NIT** — minor: a few missing image alts, one suboptimal anchor.

Report-only — never edit. For schema gaps, emit **ready-to-paste JSON-LD** for
the missing `@type`s. For prose / term gaps, point to `/pb-copy` (it owns the
rewrite; do not duplicate it here).

### 6. Blueprint mode (`--blueprint`)

Run steps 2-3, then emit a spec to publish near 100 from scratch:

- H1 + title containing the query.
- Section outline (H2/H3) covering the competitor topic structure.
- The JSON-LD `@type`s to include, with stub blocks.
- The semantic terms / entities to work in (incl. alt + anchor text).
- A target word count (the competitor median).
- The structured blocks to include (FAQ / table / list).

End by offering `/pb-copy --mode generate` per section to write the actual copy
against the blueprint.

### 7. Report

```
pb-pop: <audit | blueprint>
Target:     <url | file>
Query:      <target query>   Sector: <detected/declared>
Benchmark:  <competitor URLs, median words> | (--no-benchmark: absolute scoring)
AI access:  <all crawlers allowed | BLOCKED: GPTBot, …>   llms.txt: <yes|no>
Cite-check: <cited by Perplexity | not cited (competitor X is) | n/a>

Score: NN/100  —  <Critical | Weak | On the way | Strong>

  Keyword placement      nn/10
  Schema                 nn/18
  Semantic terms         nn/17
  Structure              nn/15
  Passage extractability nn/15
  Internal links         nn/5
  Content depth          nn/10
  E-E-A-T                nn/10

Findings: N (X BLOCKER, Y IMPORTANT, Z NIT)

[BLOCKER]
  <signal> — <what's missing> 
    fix: <paste-ready JSON-LD | concrete instruction | "run /pb-copy">
[IMPORTANT]
  ...
[NIT]
  ...
```

End with the single highest-leverage move to clear the next band, and — if prose
or copy is the gap — the `/pb-copy` hand-off.

## What this command does NOT do

- Not a rewriter — it scores and instructs. Copy changes are `/pb-copy`; it does
  not edit files.
- Not a live ranking checker — it benchmarks on-page signals against current
  rankers, it does not query Search Console or guarantee positions.
- Not a schema injector — it emits paste-ready JSON-LD but does not write it into
  your files (no auto-apply, by design).
- Not the design pass — visual structure quality is `/pb-design-review`.
