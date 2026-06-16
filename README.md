# pb-suite

A hand-picked set of Claude Code slash commands for a solo-founder workflow. Each command is a single markdown file the LLM reads as instructions — there is no runtime, no telemetry, no multi-agent dispatch, no specialist personas. Just focused checks with a shared severity model and respect for per-project `CLAUDE.md`.

Current version: see `VERSION`. Changes: see `CHANGELOG.md`.

## How it works

Claude Code reads slash commands from `~/.claude/commands/*.md`. `./install` symlinks every file in this repo's `commands/` directory into that folder, so editing a source file here takes effect immediately — no rebuild, no reload.

Each command file has YAML frontmatter (`description`, `allowed-tools`, optional `argument-hint`) followed by markdown sections the LLM follows step-by-step. A few commands shell out to small Bun + Playwright scripts in `scripts/` (`pb-browse`, `pb-qa`, `pb-prune-tests`) for things an LLM cannot do directly — fetching pages, running headless browsers, parsing test files.

```
banjul/
  commands/          source markdown — one file per /pb-* command
  scripts/
    browse.ts        pb-browse: URL → markdown via Playwright + Turndown
    qa.ts            pb-qa: visit routes, capture console/network errors, screenshots
    prune-tests.ts   pb-prune-tests: detect broken imports, all-skipped files
    lib/
      bootstrap.sh   single entry point — sets $PB_SUITE, sourced by commands
      scope.sh       shared diff-scope detection for commands that read a diff
  tests/             bash smoke tests for install mechanics and content invariants
  install            symlink commands/ into ~/.claude/commands/, install deps
  uninstall          remove only symlinks that point back to this repo
  VERSION            semver string
  CHANGELOG.md       newest-first version history
```

## Install

```bash
./install
```

What it does:

1. Symlinks `commands/pb-*.md` into `~/.claude/commands/` (idempotent; backs up pre-existing regular files as `<name>.bak.<timestamp>`).
2. Symlinks `scripts/lib/bootstrap.sh` to `~/.claude/commands/pb-bootstrap.sh` so commands can resolve `$PB_SUITE` with a single `source` line.
3. Runs `bun install` if `node_modules/` is missing (required for `pb-browse`, `pb-qa`).
4. Runs `bunx playwright install chromium` if the Chromium bundle is missing (~150MB, one-time).

First run takes ~30s for the Chromium download. Subsequent runs are instant.

Custom install location:

```bash
CLAUDE_COMMANDS_DIR=/some/other/path ./install
```

Uninstall:

```bash
./uninstall
```

Only touches symlinks pointing back into this repo — foreign symlinks and regular files are left alone.

## Editing and extending

Edit the source files in `commands/`. The symlinks in `~/.claude/commands/` point directly at these files, so every change is live in the next Claude Code session immediately — no re-install needed.

To add a new command, drop `commands/pb-<name>.md` and run `./install` to symlink it.

### File conventions

- Compact: ~70 lines, 5–7 numbered steps.
- Frontmatter with `description` and `allowed-tools`; `argument-hint` if it takes args.
- Reuse the severity model below — do not invent new severity tiers.
- If the command reads a diff, source `scripts/lib/scope.sh` to get the standard scope-detection logic.
- Respect per-project `CLAUDE.md`. Do not hard-code style rules that belong in a project's own instructions.
- No telemetry, no session state, no update checks.

## Commands

Two-letter mnemonic for the cluster, then a one-line summary. Full instructions live in the corresponding `commands/pb-<name>.md` file.

**Reviewing and shipping**

| Command | Purpose |
|---|---|
| `/pb-review` | Pre-landing code review against the diff — correctness, safety, completeness, tests. |
| `/pb-design-review` | UI review combining Refactoring UI principles, structured visual critique, and the suite severity model. Diff pass + optional live-URL screenshot critique. |
| `/pb-cso` | Pre-launch security audit (OWASP Top 10 + STRIDE) with a confidence gate. `--diff` for changed-files-only. |
| `/pb-copy` | Copywriting review/rewrite. Strips AI-slop, enforces `CLAUDE.md` brand-tone, applies one framework per surface (AIDA/PAS/FAB/BAB). Modes: rewrite / critique / generate / brand-check. |
| `/pb-check` | Single-call orchestrator: runs pb-review + pb-design-review (if UI) + pb-cso `--diff` + pb-qa (if URL given), aggregates findings, surfaces cross-PR patterns. Audit only — no merge, no test runs. |
| `/pb-ship` | Pre-merge gate: pb-review + `e2e-from-pr` verify, classifies each new spec (`persist` / `revert` / `ask`), ship/wait/decide prompt. Never auto-merges. Refuses `--no-verify`, `--no-gpg-sign`, `--force`. |
| `/pb-pr` | Drafts a PR description from the branch diff. Reads `CLAUDE.md` for tone, fills `.github/pull_request_template.md` if present. User picks open / draft / revise / copy / cancel. Pass `--prepare` to write the draft to `.context/pr-draft.md` + clipboard instead of calling `gh` — for Conductor's Create PR button or any non-`gh` flow. |

**Investigating and auditing**

| Command | Purpose |
|---|---|
| `/pb-investigate` | Root-cause debugging. Iron law: no fix without reproduction and hypothesis. Three failed fixes triggers a step back. Optionally appends a one-liner to `.claude/incidents.md`. |
| `/pb-audit` | Adversarial read-only audit of existing stable code (no diff). Behavior inventory + coverage map + testability + OWASP + GDPR + defect register. Modes: A (audit) / B (audit + characterization plan) / C (inventory backfill). |
| `/pb-qa` | Runtime QA — visits routes via headless Chromium, captures console errors, 5xx responses, broken images. Per-route screenshots. Read-only. |
| `/pb-browse` | Fetch a URL via headless Chromium, return clean markdown via Turndown. Self-contained — no MCP, no WebFetch dependency. Optional screenshot. |
| `/pb-env-check` | Diff `.env.example` vs local env files vs Vercel env (per environment). Flags missing, undocumented, prod-only, leaked. Keys only — never prints values. |
| `/pb-prune-tests` | Audit the test suite for likely-obsolete specs: broken imports, all-skipped files, references to long-merged PRs. Report only — no deletions without explicit approval. |

**Development discipline**

| Command | Purpose |
|---|---|
| `/pb-implement` | Spec-first feature implementation — the orchestration layer that drives the rest of the suite. Builds a written spec (interviews via `AskUserQuestion` when context is thin), declares a verification plan *before* coding that **routes specialist reviews by what the change touches** (`/pb-cso --diff`, `/pb-design-review`, `/pb-copy`, `/pb-env-check` via the `CLAUDE.md` trigger table), gates strict-bucket work behind explicit human approval, then drives every slice through `/pb-tdd`'s RED→GREEN→REFACTOR loop with one sub-agent per slice (parallel waves; stuck slices escalate to `/pb-investigate`). Reviews with `/pb-check` breadth plus an independent cross-model Codex pass, feeds recurring patterns to `.claude/lessons.md` / `.claude/incidents.md` (→ `/pb-evolve`), hands off to `/pb-pr`, and proposes capturing repeatable work as a skill. `--spec <file>` / `--interview` / `--plan-only` / `--no-parallel`. |
| `/pb-tdd` | Test-first workflow. Greenfield (RED→GREEN→REFACTOR) or brownfield (CHARACTERIZE→RED→GREEN→REFACTOR), auto-detected. Risk buckets — strict for money/privacy/auth/AI/retention/evaluation, light for routine CRUD, skip for docs. One vertical slice per call. `--auto` infers the slice from working tree + branch + recent commits. |

**Suite management and cross-project**

| Command | Purpose |
|---|---|
| `/pb-init` | Opt a project into pb-suite. Adds gitignore entries for `.pb-qa/` / `.pb-design-review/` / `.pb-browse/`, offers to create `.claude/lessons.md` and `.claude/incidents.md`, scaffolds a `CLAUDE.md` skeleton if missing. Per-item `AskUserQuestion`. Idempotent. |
| `/pb-rules` | Inject or update the canonical pb-suite Workflow block (trigger table, risk buckets, severity model) in a `CLAUDE.md`. Per-repo default; `--global` writes to `~/.claude/CLAUDE.md`. Single source of truth — re-run after suite updates. |
| `/pb-resume` | "Where was I?" for one repo — git state, recent activity, open PRs, CI status, suggested next step. Solo-founder context recovery after an interruption. |
| `/pb-across` | Run a shell or `/pb-*` command across every project one level deep in `Projects/Active/` (handles nested repos like `Group/repo`). Filter / parallel / summary modes. |
| `/pb-evolve` | Reads `.claude/lessons.md` and `.claude/incidents.md`, clusters recurring patterns at n≥3, proposes surgical edits to pb-* skills. Never auto-applies. `--global` for cross-repo signal, `--apply` to commit changes. The only command that edits the suite itself. |
| `/pb` | Discovery index. Prints the trigger table + every installed pb-* command with its description + repo signals (CIL? `CLAUDE.md`? load-bearing block? opt-ins?) + a one-line suggested next step from git state. Read-only. |

## CIL integration (opt-in, auto-detected)

When a repo has a top-level `CIL/sources.md`, some pb-* commands automatically enable a CIL bridge:

- `/pb-resume` — adds Linear (assigned, In Progress + Todo) and recent Notion specs. `--no-cil` to suppress.
- `/pb-pr` — extracts a tracker key from the branch name (e.g. `EVA-198-foo`), seeds the summary from the Linear ticket, appends `Closes <KEY>`.
- `/pb-ship` — the gate splits into ship / wait / defer / decide. `defer` opens a Linear follow-up; `decide` stays for genuinely strategic choices (cil-decide enforcement). Exit-readiness forced-read prompt on external-surface / load-bearing / legal / billing / auth diffs.
- `/pb-cso` — canonical-narrative check: when `CLAUDE.md` declares a narrative (e.g. privacy-first) and the diff adds external-surface copy, flags a missing concrete claim (IMPORTANT) or contradictory copy (BLOCKER).
- `/pb-evolve --cil` — reads `CIL/improvements/*.md` and `CIL/incidents.md` in addition to the `.claude/*.md` artifacts.

Outside a CIL repo all of the above no-op. No MCP requirement — if the Linear/Notion MCP is not connected, the bridge drops silently and the command continues.

## Shared mechanics

### Severity model (suite-wide)

- **BLOCKER** — auto-fix if the change is trivial and local; otherwise list and stop. In `/pb-cso`, BLOCKER requires a concrete exploit scenario.
- **IMPORTANT** — ask before fixing (taste call, completeness gap, ambiguous).
- **NIT** — mention once, do not fix unless asked.

### Scope detection (commands that read a diff)

Source `scripts/lib/scope.sh` rather than re-implementing this:

- On `main` / `master` → `@{u}` (unpushed commits).
- On a feature branch → `origin/main` → `origin/master` → local `main`/`master` → `HEAD~1`.

Never `@{u}` on a feature branch: that resolves to `origin/<feature>` and yields an empty diff after a push.

Scope-creep check via `comm -13` (committed files vs worktree-changed files) surfaces unrelated WIP before it leaks into a PR.

### Verify vs regress (`/pb-ship`)

`e2e-from-pr` by default writes new specs into the permanent suite, which grows monotonically and slows CI. `/pb-ship` classifies each new spec:

- **default (smart)** — `persist` (contract, security, load-bearing, fixed-bug regression), `revert` (visual, marketing surface, observable, duplicate), or `ask` (borderline → `AskUserQuestion`).
- **`--regress`** — everything persists (skip classifier).
- **`--no-regress`** — everything reverts (skip classifier; original verify-mode).
- **`--dry`** — run + classify, no merge prompt.

Default mode requires a clean working tree (the selective revert assumes all changes came from `e2e-from-pr`).

### Learning artifacts (opt-in, per-project)

- `.claude/lessons.md` — `/pb-check` appends cross-PR patterns.
- `.claude/incidents.md` — `/pb-investigate` appends one-line root causes.
- `/pb-evolve` reads both and proposes suite edits at n ≥ 3.

These files are per-project opt-in (created by `/pb-init` or by the user), gitignored by convention, and never leave the project. There is no central telemetry.

## Notes for agents

If you are an LLM agent working in this repo:

- **Don't invent commands.** The slash-command list in this README is the full set. If a workflow needs something missing, it's a feature request, not a runtime detail.
- **Source the canonical workflow rules from `/pb-rules`**, not from this README. The injected Workflow block in a downstream project's `CLAUDE.md` is the contract — this README is documentation.
- **Editing a command? Match the existing conventions** (frontmatter, ~70 lines, numbered steps, severity tiers, scope-detection via `scope.sh`). Don't introduce new severity levels or new orchestration patterns without discussing first.
- **Test changes** with `./tests/smoke.sh` after editing. The smoke tests cover install/uninstall mechanics and content invariants on the skill files — they don't (and can't) cover what the LLM does with the markdown.
- **`$PB_SUITE`** inside a command resolves via `source ~/.claude/commands/pb-bootstrap.sh`. Honor `PB_SUITE_HOME` if set (testing, non-standard installs).
- **Refusal flags are non-negotiable.** `/pb-ship`, `/pb-pr`, and any merge-adjacent command refuse `--no-verify`, `--no-gpg-sign`, `--force`, `-f`. Do not soften these.

## Tests

```bash
./tests/smoke.sh
```

Covers install/uninstall mechanics, `$PB_SUITE` resolution, presence of refuse-flag patterns, canonical headings in skill files, and embedded-bash refuse conditions. Exit 0 = pass. See `tests/README.md` for what is intentionally not covered.

## Out of scope

No multi-agent dispatch, no telemetry, no specialist personas, no pre-flight bash that mutates config state. If a future need requires heavier browser automation (anti-bot, headed mode, long-lived daemon), that becomes a deliberate addition under `scripts/` — not a meta-layer over an external tool.
