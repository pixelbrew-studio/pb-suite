# Changelog

Notable changes to pb-suite. Follows semver, written newest-first.

## 0.5.0

- Add `/pb-pop` — PageOptimizer-Pro-style SEO / AI-citability audit. Scores a page 0-100 against the on-page signals AI answer-engines and Google reward (keyword placement, schema markup, semantic-term/entity coverage, page structure, internal links, content depth, E-E-A-T) and — its defining trait — calibrates the score by benchmarking against the pages currently ranking for the target query (`WebSearch` the query → scrape the top rankers → derive relative term/word-count/schema targets), not a fixed checklist. Accepts a live URL, a local `.html` (both via the new `scripts/pop.ts`), or `.mdx`/`.tsx` source files (read directly). Report-only by suite severity — BLOCKER for a missing critical signal (no schema, H1/title missing the query, >20% under the competitor median, missing trust signal in a strict YMYL sector), IMPORTANT for partial coverage, NIT for minor; schema gaps emit paste-ready JSON-LD, prose gaps hand off to `/pb-copy`. `--blueprint` mode specs a not-yet-written page (headings, schema, terms, word count) to publish near 100; `--no-benchmark` falls back to absolute scoring.
- Add `scripts/pop.ts` — Playwright SEO-signal extractor. The inverse of `browse.ts`: it deliberately **keeps** `<head>`/`<script>`/`<nav>` (parsing JSON-LD schema, meta description, canonical, OG tags, the full heading tree, word count, wall-of-text signal, list/FAQ/table structure, image alt and link anchor text) — exactly what `browse.ts` strips. Also fetches `robots.txt` + `llms.txt` and reports which AI crawlers (`GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, …) are blocked for the page's path, and returns a `sections[]` map (each heading → its opening passage) for passage-extractability scoring. No new dependency (Playwright already present).
- `/pb-pop` AI-citation efficacy pass: (1) an **AI-crawler access gate** — a blocked bot is a BLOCKER reported above the score, since the page cannot be cited by that engine regardless of on-page quality; (2) a **passage-extractability** category (weight 15) scoring whether each section opens with a direct, self-contained, liftable answer — the actual unit AI engines quote; (3) a **`--cite-check`** mode that queries the target question against AI search and reports whether the page's domain is cited today (a measured "not cited while a competitor is" promotes the responsible finding to BLOCKER and feeds `/pb-evolve` to calibrate weights from real outcomes); (4) schema **validity** folded into the schema score; (5) an off-page/entity ceiling note so a high on-page score never reads as "done"; (6) a documented `## SEO` project block (`CLAUDE.md`) for sector, target queries, house schema, and entity. Categories reweighted to keep the sum at 100.
- Add `references/seo-signals.md` — the editable knowledge base `/pb-pop` reads at runtime. Signal categories + weights (sum to 100), 0-100 band thresholds, E-E-A-T strictness by sector, schema-type catalog by page kind, structure heuristics, and "what AI answer-engines cite" notes — all dated and git-diffable so insights update with no skill edit. New top-level `references/` dir, kept out of `commands/` so `install` never symlinks it as a slash command. Per-project overrides come from `CLAUDE.md`.
- `/pb-evolve` can now propose dated edits to `references/seo-signals.md`, not just skill bodies — recurring SEO/citation patterns from the learning artifacts feed the knowledge base.
- `/pb-rules` canonical block adds a trigger row: touching `marketing/` / `landing/` / SEO pages → `/pb-pop` before opening a PR.

## 0.4.0

- Add `/pb-implement` — spec-first feature implementation, the orchestration layer above `/pb-tdd`. Establishes a written spec (interviews via `AskUserQuestion` when context is thin, writing the result to `.context/spec-<slug>.md`), declares a verification plan *before* any code (tests / `/pb-qa` / `/pb-browse` / MCP, with an augmentation-vs-automation taste test per behavior on the 80/20 rule), gates strict-bucket work behind an explicit human-validation approval, then drives every slice through `/pb-tdd`'s RED→GREEN→REFACTOR loop with **one sub-agent per slice** — the orchestrator pre-assigns each slice's Given/When/Then, risk bucket, test layer, and owned files, dispatches independent slices in parallel waves and dependent ones in dependency order, and rejects any slice that returns red or skipped its RED step. Verifies against the declared plan, then reviews in two diverse passes: **suite breadth** via `/pb-check` (fans out `/pb-review` + `/pb-design-review` + `/pb-cso --diff` + `/pb-qa` and appends patterns to `.claude/lessons.md`) and **cross-model depth** via an independent Codex review of the diff — findings from both triaged through the suite severity model, real BLOCKERs fixed test-first (escalated to `/pb-investigate` when the cause isn't obvious), dismissals justified. The verification plan **routes specialist reviews by what the change touches** through the `CLAUDE.md` trigger table (`/pb-cso`, `/pb-design-review`, `/pb-copy`, `/pb-env-check`), stuck slices (two failed gates) escalate to `/pb-investigate` instead of a third blind retry, recurring patterns feed `.claude/lessons.md` / `.claude/incidents.md` for `/pb-evolve`, and the run hands off to `/pb-pr` (verification plan → `## Test plan`). Reuses the suite rather than duplicating it. Flags: `--spec <file>` / `--interview` / `--plan-only` / `--no-parallel`.
- Add `scripts/lib/cil.sh` — opt-in CIL integration helpers, no-op outside a CIL repo (detected via top-level `CIL/sources.md`). Provides `cil_repo_p`, `cil_linear_ticket_from_branch`, `cil_external_surface_p`, `pb_load_bearing_paths`, `pb_load_bearing_p`. Skills source this and degrade silently when the file or repo is absent.
- Add `/pb` — discovery index. Prints the canonical trigger table (repo's `## Workflow (pb-suite)` block, falling back to `pb-rules` canonical), every installed `pb-*` command with its description, repo signals (CIL? CLAUDE.md? load-bearing block? opt-ins?), and a one-sentence suggested next step from git state. Read-only.
- `/pb-resume` now auto-bridges Linear + Notion context when running inside a CIL repo. Adds a capped section listing assigned Linear tickets (In Progress + Todo) and Notion specs updated in the window; the branch's matching ticket is starred. Pass `--no-cil` to suppress. Removed stale "out of scope (v1)" note about Linear/Notion crossref.
- `/pb-pr` extracts a tracker key (e.g. `EVA-198`) from the branch name and seeds the PR summary from the ticket via the Linear MCP when available. Appends `Closes <KEY>` to the default template so Linear auto-links on open. Fails open — no tracker, no MCP, no-op.
- `/pb-ship` splits the gate into four options: **ship / wait / defer / decide**. **defer** opens a Linear follow-up via MCP (or prints a paste-ready draft) for "do later, not strategic" — keeps `cil-decide` reserved for genuinely strategic choices, matching its scope-rule. Adds a step 6a exit-readiness forced-read prompt when the diff touches external surfaces, load-bearing paths, or `legal/` / `subprocessor` / `privacy` / `billing/` / `auth/` in a CIL repo. Reads `CIL/exit-readiness.md` when present.
- `/pb-cso` adds a step 6b canonical-narrative check. When `CLAUDE.md` declares a canonical narrative (e.g. privacy-first) AND the diff adds user-facing copy on an external surface, surfaces in `IMPORTANT` when no concrete claim backs the narrative, `BLOCKER` when the copy actively contradicts it. Cliché "we take X seriously" lines do not count.
- `/pb-rules` canonical block now (1) documents the `## pb-suite: load-bearing files` block — repo-level globs consumed by `/pb-ship` (classifier) and `/pb-cso` (severity heightening); (2) mentions `--cil` for `/pb-evolve` when in a CIL repo; (3) adds a trigger row for branch-encoded tracker keys (`EVA-198-foo` → `Closes` footer).
- `/pb-evolve` accepts `--cil` (auto-enabled when `cil_repo_p`, pass `--cil=off` to suppress). Ingests `CIL/improvements/*.md` and `CIL/incidents.md` in addition to the `.claude/*.md` artifacts. Marks CIL-sourced samples with `[CIL]` in step 6.
- `install` now also symlinks `commands/pb.md` (previously only `pb-*.md` matched the glob).

## 0.3.1

- Add `/pb-rules` — inject the canonical pb-suite Workflow block (trigger table mapping change-types to commands, risk buckets, severity model, default test stack) into a `CLAUDE.md` file. Per-repo by default; `--global` writes to `~/.claude/CLAUDE.md`. Idempotent: diffs against existing block, asks before overwriting. Single source of truth — re-run after suite updates to pick up changes.
- `/pb-init` step 5 scaffold no longer hardcodes pb-suite conventions; instead leaves a comment pointing to `/pb-rules` and the final report tells the user to run it next. Avoids drift between two skills owning the same content.

## 0.3.0

- Add `/pb-init` — opt a project into pb-suite. Detects what is missing (gitignore entries for `.pb-qa/` / `.pb-design-review/` / `.pb-browse/`, `.claude/lessons.md`, `.claude/incidents.md`, `CLAUDE.md`) and offers each via `AskUserQuestion`. Idempotent — safe to re-run. `--minimal` skips the `CLAUDE.md` scaffold offer.
- Add `/pb-pr` — draft a PR description from the branch diff. Reads `CLAUDE.md` for brand-tone, infers intent (`fix` / `feature` / `refactor` / `chore` / `mixed`), fills `.github/pull_request_template.md` if present, otherwise suite default with Summary + Test plan. Shows draft → user picks open / draft / revise / copy / cancel. Refuses `--no-verify` / `--force`. Surfaces mixed-intent branches as a smell.
- Add `CHANGELOG.md` — version history written newest-first. Backfilled from git log.

## 0.2.0

- Add `/pb-evolve` — meta-skill that reads `.claude/lessons.md` (from `/pb-check`) and `.claude/incidents.md` (from `/pb-investigate`), clusters recurring patterns at n≥3, and proposes surgical `add` / `remove` / `re-tier` edits to pb-* skills. Per-candidate `AskUserQuestion` on `--apply`; refuses on dirty `$PB_SUITE` working tree; excludes itself, `bootstrap.sh`, `scope.sh` from candidate skills.
- Add `scripts/lib/bootstrap.sh` — single entry point that resolves `PB_SUITE` and honors `PB_SUITE_HOME` override. Installed as `~/.claude/commands/pb-bootstrap.sh` symlink. Replaces the 3-line `readlink + dirname + source` dance across 7 skills with one source line.
- Add optional step 10 to `/pb-investigate` — appends a one-line root-cause summary to `.claude/incidents.md` when that file already exists. Opt-in per project; never created unsolicited.
- `/pb-ship` preflight now refuses `--no-verify`, `--no-gpg-sign`, `--force`, `-f` — the merge gate is non-negotiable.
- `/pb-resume` next-step suggestions now reference pb-suite siblings (`/pb-review`, `/pb-tdd --auto`, `/pb-check`, `/pb-ship`, `/pb-copy --mode brand-check`) instead of just basic git verbs.
- `/pb-review` Safety section trimmed to diff-level quick wins; CORS/CSP/CSRF/secrets-in-history deferred to `/pb-cso --diff` (one-line pointer added).
- `/pb-audit` phase 4 collapsed to one paragraph referencing `/pb-cso` steps 6+7 instead of re-explaining the OWASP checklist.
- README "Niet in scope" clarified — "geen learning-files" → "geen telemetrie"; explicit note that `.claude/lessons.md` and `.claude/incidents.md` are opt-in per-project artifacts that stay local.

## 0.1.3

- `/pb-copy` monorepo-aware brand-tone discovery — reads `packages/*content-style*|*voice*|*tone*|*brand*|*copy*|*content*/CLAUDE.md` plus typed constants (`PREFERRED_WORDS`, `AVOIDED_WORDS`, `TONE`, `BRAND_PROMISE`, `PRODUCT_NAMING`). Picks up Acme's `@acme/content-style` package automatically. Per-app override when CWD is `apps/<name>/`.

## 0.1.2

- Add `/pb-copy` — copywriting review and rewrite, AI-slop detection, brand-tone enforcement from `CLAUDE.md`. Modes: rewrite / critique / generate / brand-check.

## 0.1.1

- Add `/pb-tdd` auto-context detection (step 1.5) — when description is missing or vague, scan working tree + branch + recent commits + TODO/FIXME markers and propose 2-4 candidate slices via `AskUserQuestion`.

## 0.1.0

Initial release. Skills shipped:

- `/pb-review` — pre-landing code review (correctness, safety, completeness, maintainability)
- `/pb-design-review` — comprehensive UI review combining Refactoring UI checklist, art-director critique, and pre-merge severity model
- `/pb-investigate` — root-cause debugging with the iron law "no fix without investigation"
- `/pb-cso` — pre-launch security audit (OWASP Top 10 + STRIDE) with confidence-gate
- `/pb-ship` — pre-merge orchestrator with smart classifier (persist / revert / ask) and ship/wait/decide gate
- `/pb-browse` — URL to markdown via headless Chromium (Bun + Playwright + Turndown)
- `/pb-qa` — runtime QA via headless Chromium, per-route screenshots, severity-classified findings
- `/pb-prune-tests` — audit test suite for broken imports, all-skipped files, stale PR references
- `/pb-check` — comprehensive orchestrator with cross-pass "Lessons" section
- `/pb-tdd` — test-first development discipline, greenfield or brownfield, risk-bucketed
- `/pb-audit` — adversarial audit of stable code (no diff) with defect register
- `/pb-resume` — single-repo context recovery with suggested next step
- `/pb-across` — run a shell or pb-command across every project in `Projects/Active/`
- `/pb-env-check` — diff `.env.example` vs local env vs Vercel env

Shared infra:

- `scripts/lib/scope.sh` — single source of truth for diff-base detection
- `scripts/browse.ts`, `scripts/qa.ts`, `scripts/prune-tests.ts` — Bun + Playwright scripts
- VERSION tracking in `~/.pb-suite-version` with transition-line on install
