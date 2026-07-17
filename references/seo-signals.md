# SEO / AI-citability signals — pb-pop knowledge base

The volatile scoring rules for `/pb-pop`. The skill reads this file at runtime;
the skill body holds only procedure. Edit here when insights change — no skill
edit needed. Keep dated entries in the changelog at the bottom so `/pb-evolve`
and `git diff` can track what moved and why.

Per-project overrides live in the project's `CLAUDE.md` (a `## SEO` or
`## pb-pop` block): sector, target keywords, house schema types. Project rules
override the defaults here on conflict.

---

## Gate: AI-crawler access (pass/fail, before scoring)

Check this first — it is a gate, not a weighted category, because if it fails the
score is moot: the page cannot be cited by that engine no matter how good the
on-page signals are. `pop.ts` reports `aiAccess.blocked` (AI bots disallowed for
this page's path in `robots.txt`) and `aiAccess.llmsTxt`.

- Any AI bot in `aiAccess.blocked` (`GPTBot`, `OAI-SearchBot`, `ChatGPT-User`,
  `ClaudeBot`, `Claude-Web`, `anthropic-ai`, `PerplexityBot`, `Perplexity-User`,
  `Google-Extended`, `Applebot-Extended`, `CCBot`, `Bytespider`, `Amazonbot`) →
  **BLOCKER**. State which engine each bot feeds (e.g. blocking `Google-Extended`
  removes you from Google AI Overviews / Gemini grounding; `OAI-SearchBot` from
  ChatGPT search; `PerplexityBot` from Perplexity).
- `llms.txt` absent → NIT (emerging convention; an `llms.txt` / `llms-full.txt`
  index of canonical content helps AI tools find the authoritative version).

A blocked AI crawler is the highest-priority finding in the whole audit — report
it above the score.

## Signal categories and weights

The score is 0-100. Each category contributes up to its weight. Weights sum to
100. Score a category as a fraction of its weight based on coverage, calibrated
to the competitor benchmark where one was run (see "Calibration").

| # | Category | Weight | What earns the points |
|---|---|---|---|
| 1 | Keyword placement | 10 | Target query (or close variant) present in the `<title>` AND the single `<h1>`. Half credit if in one but not both. |
| 2 | Schema markup | 18 | JSON-LD present, covers the page-appropriate `@type`s (see catalog), AND is **valid** (required properties present, correct nesting) — invalid blocks are ignored by Google/AI, so score them as absent. Calibrate target types to what ranking competitors use. |
| 3 | Semantic terms / entities | 17 | Coverage of the topic's related terms and entities — in body, AND in image `alt` text and link anchor text. Thin keyword-repetition without supporting entities scores low. |
| 4 | Page structure | 15 | Lists, FAQ sections, tables present; no walls of text. AI answer-engines extract from structured blocks. |
| 5 | Passage extractability | 15 | Each section opens with a direct, self-contained, factual answer an LLM can lift verbatim (see below). This is the unit of AI citation — a page can rank yet never be quoted if no passage cleanly answers a question. |
| 6 | Internal links | 5 | Meaningful internal links to related content with descriptive anchors (not "click here"). |
| 7 | Content depth | 10 | Word count within ~20% of the competitor median (or sector norm if no benchmark). Significantly shorter reads as under-treated. |
| 8 | E-E-A-T / trust | 10 | Named author, organization/expert schema, credentials, citations — strictness varies by sector (see below). |

If a category does not apply to a page kind (e.g. internal links on a
single-page microsite), redistribute its weight proportionally across the rest
and note it in the report.

## Passage extractability (what AI engines actually quote)

AI answer-engines cite a *passage*, not a page. Score each section in
`pop.ts`'s `sections[]` (heading → its opening paragraph):

- **Answer-first** — the opener states the answer directly in the first
  sentence, not after a wind-up. "The product scores candidates on evidence from
  their work, not keyword-matched CVs." beats "When it comes to hiring, there are
  many things to consider…".
- **Self-contained** — the sentence stands alone without the heading or prior
  context. An LLM lifting it into an answer should still have it make sense.
- **Declarative and factual** — a checkable claim, ideally with a number or named
  entity, not a rhetorical question or a CTA.
- **Question-shaped headings help** — a heading phrased as the user's question
  with an immediate answer below is the single most citable structure.

Sections whose opener is a CTA, a tagline, or empty score low. Branding headings
("Help when you need it") over query headings ("Plumber London") are the classic
extractability failure.

## Band thresholds (0-100)

| Band | Range | Meaning |
|---|---|---|
| Critical | 0-25 | Near-invisible to search engines and AI. |
| Weak | 26-50 | Key signals missing; ranking unlikely. |
| On the way | 51-79 | Signals present but insufficient for top results. |
| Strong | 80-100 | Target band — built to rank and be cited by ChatGPT / Perplexity. |

Goal is ≥ 80. The source study's average page scored ~33; commercial "money
pages" averaged ~33.6. Clearing 80 is where AI citation becomes consistent.

## E-E-A-T strictness by sector

Trust signals are a baseline-to-exist requirement, not a booster, for:

- **Strict baseline** — legal, health/medical, finance, and local services
  (YMYL-adjacent). Here a missing author/credential/organization schema is a
  BLOCKER, not an IMPORTANT. You cannot out-rank the trust gap with other
  signals alone.
- **General** — everything else. Trust signals are IMPORTANT; their absence
  lowers the E-E-A-T category score but does not hard-block.

The skill reads the project sector from `CLAUDE.md`; if absent, infer from the
page content and state the assumption in the report.

## Schema-type catalog (which `@type` matters for which page kind)

Calibrate the target set to what ranking competitors actually use — this is the
default starting point, not a fixed checklist.

| Page kind | Expected JSON-LD `@type`(s) |
|---|---|
| Article / blog post | `Article` / `BlogPosting`, `Person` (author), `Organization` (publisher), `BreadcrumbList` |
| Product / commerce | `Product`, `Offer`, `AggregateRating`, `BreadcrumbList` |
| Local business | `LocalBusiness` (or specific subtype), `PostalAddress`, `OpeningHoursSpecification`, `GeoCoordinates` |
| Service / landing | `Service`, `Organization`, `FAQPage`, `BreadcrumbList` |
| Expert / about / profile | `Person`, `Organization`, credentials via `hasCredential` / `knowsAbout` |
| FAQ / how-to | `FAQPage`, `HowTo` |
| Home | `Organization` / `WebSite` with `SearchAction` |

Most-missed signal in the source study: 99% of pages missed at least one
recommended schema type; the average page missed ~10 relevant types. Schema is
the highest-leverage, most-neglected fix.

## Structure heuristics

- **Wall of text** — a single paragraph over ~800 characters with no
  intervening list/table/subheading is a structure penalty. Multiple such
  paragraphs compound it.
- **List / FAQ / table presence** — at least one structured block per ~600
  words of body. AI engines preferentially extract from these.
- **Heading hygiene** — exactly one `<h1>`; logical `<h2>`/`<h3>` nesting; no
  skipped levels used purely for styling.

## What AI answer-engines actually cite (most likely to change — date edits)

- Structured blocks (lists, FAQ, tables) over prose for direct-answer extraction.
- Sources with explicit schema-declared identity (named author, organization,
  expert) over anonymous pages — schema reduces the model's work to verify trust.
- Topic depth signalled by entity coverage, not keyword density.
- Content that matches or exceeds the depth of the currently-cited set; pages
  >20% shorter than the cited median are treated as under-treating the topic.

## Calibration (when a competitor benchmark was run)

When `/pb-pop` ran a benchmark (default mode), calibrate relative — not absolute:

- **Content depth** — score against the competitor median word count, not a
  fixed number. There is no magic word count.
- **Schema** — target the union of `@type`s the ranking competitors use for this
  page kind, intersected with the catalog above.
- **Semantic terms** — the recurring entities/terms across competitors are the
  coverage target; missing the common ones is the gap that matters.

When `--no-benchmark` was used, fall back to the absolute defaults in this file
and say so in the report — the score is a checklist, not competitor-calibrated.

## Citation reality check (`--cite-check`)

The score is a proxy; the real KPI is whether AI engines cite the page *today*.
When `/pb-pop --cite-check` runs, it queries the target question against AI
search and checks whether the page's domain appears in the cited sources.

- **Cited** — the goal. Note which engine and which competing sources also appear.
- **Not cited but a competitor is** — the gap is real and measurable; the
  competitor's on-page signals are the calibration target.
- **Nobody cited / no AI answer** — the query may not trigger an AI answer; fall
  back to the proxy score.

Treat a confirmed "not cited while competitors are" as escalating any
IMPORTANT structural/schema finding toward BLOCKER — it is no longer
hypothetical. Feed repeated cite-check outcomes to `/pb-evolve` so the weights
above get calibrated against measured citations instead of staying estimates.

## Off-page ceiling (name it, don't score it)

This file scores on-page signals only. AI citation also depends on **entity
strength** — how known the brand is across the web (mentions, Wikidata/Knowledge
Graph presence, consistent name/URL, third-party reviews). A page can hit 95
on-page and still not be cited because the entity is weak. When on-page is strong
but cite-check fails, say so explicitly: the next work is off-page (digital PR,
entity consistency, getting listed in the sources AI tools already trust), not
more on-page tweaking. Do not let a high on-page score read as "done".

## Project SEO block (`CLAUDE.md`)

Projects override these defaults with a `## SEO` (or `## pb-pop`) block in their
`CLAUDE.md`. Recognized keys:

```md
## SEO (pb-pop)
- Sector: <legal | health | finance | local | general>   # drives E-E-A-T strictness
- Target queries: <one per money-page / topic>
- House schema: <@type list every page of this kind should ship>
- Entity: <canonical brand name, homepage URL, Wikidata/LinkedIn if any>
- Notes: <any project-specific citability constraint>
```

Project keys win over the defaults here on conflict.

---

## Changelog

- 2026-06-24 — Initial knowledge base. Weights, bands, sector strictness, schema
  catalog, and citation notes seeded from the PageOptimizer Pro source study
  (~11k pages: avg score ~33, money-page avg ~33.6, 99% missing a schema type,
  ~10 schema types missed per page, ≥80 = consistent AI citation, 79.8% missing
  a trust signal).
- 2026-06-24 — Added for AI-citation efficacy: AI-crawler access **gate**
  (robots.txt / llms.txt — blocked bot = BLOCKER above the score); **passage
  extractability** category (weight 15) as the unit AI engines actually quote;
  schema-**validity** requirement folded into the schema category; citation
  reality-check (`--cite-check`) guidance; off-page/entity ceiling note; and the
  `## SEO` project-block format. Reweighted categories to keep the sum at 100
  (keyword 15→10, schema 20→18, semantic 20→17, internal links 10→5).
