# Changelog

Notable changes to pb-suite. Follows semver, written newest-first.

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

- `/pb-copy` monorepo-aware brand-tone discovery — reads `packages/*content-style*|*voice*|*tone*|*brand*|*copy*|*content*/CLAUDE.md` plus typed constants (`PREFERRED_WORDS`, `AVOIDED_WORDS`, `TONE`, `BRAND_PROMISE`, `PRODUCT_NAMING`). Picks up Evalgist's `@evalgist/content-style` package automatically. Per-app override when CWD is `apps/<name>/`.

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
