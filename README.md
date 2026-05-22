# pb-suite

Lichte vervanger voor Garry Tan's gstack — een hand-picked set Claude Code slash-commands voor Karel's solo-workflow. Geen telemetrie, geen multi-agent dispatch, geen specialist-roleplay. Wel: gerichte checks, transparante severity, en respect voor per-project `CLAUDE.md`.

## Commands

| Command | Doel |
|---|---|
| `/pb-review` | Pre-landing code review — correctness, safety, completeness, tests |
| `/pb-design-review` | Comprehensive UI review — combineert Refactoring UI checklist (van ux-design), structured visual critique (van art-director), en de pb-suite severity-model. Diff-pass + optional live screenshot + critique in één |
| `/pb-investigate` | Root-cause debugging — iron law: no fix without investigation |
| `/pb-cso` | Pre-launch security audit — OWASP top 10 + STRIDE met confidence-gate |
| `/pb-ship` | Pre-merge orchestrator — pb-review + e2e-from-pr verify-mode + ship/wait/decide gate, nooit auto-merge |
| `/pb-browse` | URL → markdown via headless Chromium (Bun + Playwright + Turndown), optional screenshot |
| `/pb-qa` | Runtime QA — visit routes, capture console errors / 5xx / broken images, per-route screenshots |
| `/pb-prune-tests` | Test-suite opruim — detecteert broken imports, all-skipped files, oude PR-references. Rapport-only; deletions na user-approval |
| `/pb-check` | Comprehensive orchestrator — draait pb-review + pb-design-review + pb-cso + pb-qa, aggregaateert findings, geeft "Lessons" sectie met patterns. Geen merge, geen mutaties — alleen audit + leren |
| `/pb-tdd` | Test-first development discipline voor coding-agents. Greenfield (RED→GREEN→REFACTOR) of brownfield (CHARACTERIZE→RED→GREEN→REFACTOR), auto-detected. Risk-based buckets — strict voor money/privacy/auth/AI/retention/evaluation, light voor standaard CRUD, skip voor docs. Eén vertical slice per call. `--init-policy` voor het zetten van de testing-policy in CLAUDE.md |
| `/pb-copy` | Copywriting review en rewrite. Strip AI-slop ("leverage", "dive into", "In today's fast-paced..."), brand-tone uit CLAUDE.md (emoji/exclamation/superlative-bans), één framework per surface (AIDA/PAS/FAB/BAB). Mode-aware voor marketing vs product. Modes: rewrite / critique / generate / brand-check |
| `/pb-audit` | Adversarial audit van bestaande, stabiele code zonder diff. Behavior-inventory + coverage-map + testability + OWASP + GDPR + defect-register met critical/high/medium/low severity en effort-estimates. Read-only. MODE A audit / B + characterization plan / C inventory-backfill |
| `/pb-resume` | "Where was I?" voor één repo — git state, recent activity, open PRs, CI status, en een gesuggereerde volgende stap. Solo-founder context-recovery na een onderbreking |
| `/pb-across` | Run een shell- of pb-command over elk project in `Projects/Active/`. Walk-one-level-deep voor nested repos zoals `Salmon Rushhour/repo`. Filter / parallel / summary modes |
| `/pb-env-check` | Diff `.env.example` vs lokale env vs Vercel env (per environment). Vlagt missing, undocumented, prod-only en leaked. Keys-only, nooit values |
| `/pb-evolve` | Leest `.claude/lessons.md` (van pb-check) en `.claude/incidents.md` (van pb-investigate), clustert recurrent patronen over PR's heen, en stelt surgical edits voor aan pb-* skills. Nooit auto-apply — per kandidaat `AskUserQuestion`. `--global` voor cross-repo signal, `--apply` om door te voeren. De enige pb-skill die de suite zelf aanpast |
| `/pb-init` | Opt een project in voor pb-suite — voegt gitignore-entries toe voor `.pb-qa/` / `.pb-design-review/` / `.pb-browse/`, biedt aan om `.claude/lessons.md` en `.claude/incidents.md` te creëren, scaffold `CLAUDE.md` skeleton als die ontbreekt. Per-item AskUserQuestion. Idempotent — re-run is veilig |
| `/pb-pr` | Draft een PR description vanuit de branch-diff. Leest `CLAUDE.md` voor brand-tone, infereert intent (fix/feature/refactor/chore/mixed), vult `.github/pull_request_template.md` als die bestaat, anders een suite-default. Toont draft → user kiest open / draft / revise / copy / cancel. Mergen blijft `/pb-ship` |

## Verify vs regress (pb-ship)

`e2e-from-pr` schrijft tests standaard naar de permanente suite — die groeit dan monotoon en CI wordt traag. `/pb-ship` lost dat op door een classifier per spec:

- **default (smart)** — elke nieuwe spec wordt geclassificeerd als `persist` (contract, security, load-bearing, fixed-bug regression), `revert` (visual, marketing-surface, observable, duplicate) of `ask` (borderline → AskUserQuestion). De suite groeit alleen met wat echt regress-waardig is.
- **--regress** — alles permanent (skip classifier, override naar persist).
- **--no-regress** — alles revert (skip classifier, oorspronkelijke verify-mode).
- **--dry** — alles draaien + classifier, geen merge-prompt.

Default-mode vereist een clean working tree (de selectieve revert leunt op het feit dat alle changes uit `e2e-from-pr` komen).

## Severity-model (suite-breed)

- **BLOCKER** — auto-fix als het verschil triviaal en lokaal is, anders lijst
- **IMPORTANT** — vraag eerst (taste-call, completeness gap, niet-eenduidig)
- **NIT** — vermeld één regel, niet fixen tenzij gevraagd

In `pb-cso` heeft BLOCKER een extra eis: een concrete exploit-scenario beschrijven.

## Scope-detectie (alle commando's die diff lezen)

- Op `main`/`master` → `@{u}` voor unpushed commits
- Op een feature-branch → `origin/main` → `origin/master` → lokale `main`/`master` → `HEAD~1`

Nooit `@{u}` voor feature-branches: dat is `origin/<feature>` en geeft een lege diff.

Plus een scope-creep check (`comm -13` op committed-vs-worktree files) zodat unrelated WIP zichtbaar wordt voordat het mee in de PR sluipt.

## Install

```bash
./install
```

Wat het doet:
1. Symlinkt `commands/pb-*.md` naar `~/.claude/commands/` (idempotent, backupt bestaande regular files)
2. `bun install` als `node_modules/` ontbreekt (vereist voor `pb-browse` — Playwright + Turndown)
3. `bunx playwright install chromium` als de browser-bundle ontbreekt (~150MB, one-time)

Eerste run kost ~30s voor de Chromium-download. Volgende runs zijn instant.

Deinstalleren met `./uninstall` (raakt alleen symlinks die naar deze repo wijzen).

Custom locatie:

```bash
CLAUDE_COMMANDS_DIR=/some/other/path ./install
```

## Bewerken

Edit de bronfiles in `commands/`. Symlinks in `~/.claude/commands/` wijzen direct naar deze files, dus elke wijziging is meteen actief in Claude Code — geen re-install nodig.

Als je een nieuwe pb-command toevoegt, leg 'm in `commands/pb-<naam>.md` en run `./install`.

## Conventies bij toevoegen

- Compact: ongeveer 70 regels, 5-7 stappen
- Geen telemetrie, session-state, of update-checks
- Severity-model hergebruiken (BLOCKER/IMPORTANT/NIT)
- Scope-detectie copy-pasten als de command een diff leest
- Per-project `CLAUDE.md` respecteren — geen one-size-fits-all stijlregels hard-coderen
- Frontmatter met `description` en `allowed-tools`, optioneel `argument-hint`

## Niet in scope

Geen multi-agent dispatch, geen telemetrie, geen "specialist personas", geen pre-flight bash met config-state. Als de suite zwaardere browser-automation nodig heeft (anti-bot, headed mode, long-lived daemon), wordt dat een bewuste uitbreiding in `scripts/`, niet een meta-laag bovenop een externe tool.

**Note over learning-files**: pb-check schrijft optioneel naar `.claude/lessons.md`, pb-investigate optioneel naar `.claude/incidents.md`, en pb-evolve leest beide. Dat is per-project opt-in (de files moeten al bestaan of door pb-check aangemaakt zijn), gitignored-by-convention, en wordt niet naar de pb-suite gestuurd. Geen centrale telemetrie — de signal blijft lokaal bij het project dat hem produceert.
