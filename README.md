# pb-suite

A hand-picked command suite for disciplined AI-assisted product engineering.

[Built by Pixelbrew Studio](https://pixelbrew.studio/work/pb-suite) as part of its public workbench for small, inspectable tools.

`pb-suite` is built for small teams and solo builders who want AI-assisted coding to move with sharper taste, stronger review habits, and less ritual. Each command is a single markdown file read as instructions; there is no resident runtime, telemetry, background dispatcher, or hidden persona layer. Just focused checks with a shared severity model and respect for per-project `CLAUDE.md`.

Current version: see `VERSION`. Changes: see `CHANGELOG.md`.

## Why this exists

AI-assisted coding is fast enough to make bad process expensive. `pb-suite` keeps the workflow small and explicit: review the diff, investigate before fixing, verify runtime behavior, keep copy honest, check security before launch, and turn repeated lessons into better local rules.

## Where the rules come from

The checks in these commands are not a curated best-practices list. They are promoted from real defects: each project keeps a private lesson log (`.claude/lessons.md`, appended by `/pb-check`) and incident log (`.claude/incidents.md`, appended by `/pb-investigate`). When a pattern recurs across PRs (n >= 3), `/pb-evolve` proposes a surgical, generalized edit to the relevant command — a new checklist bullet, a removed high-false-positive check, or a severity re-tier — which the maintainer accepts or rejects per candidate.

Only the abstracted rule lands here; the raw lessons, project names, and incident details stay in the private project repos. Most of the sharper checks (multi-tenant RLS write-path scope-crossing, unguarded post-spend regions, the mandatory frontier cross-model review on strict diffs) exist because a same-model review plus passing tests missed exactly that defect in production code, repeatedly.

## How it works

The slash-command runner reads command files from `~/.claude/commands/*.md`. `./install` symlinks this repo's command files into that folder, so editing a source file here takes effect immediately — no rebuild, no reload.

Each command file has YAML frontmatter (`description`, `allowed-tools`, optional `argument-hint`) followed by markdown sections executed step-by-step. A few commands shell out to small Bun + Playwright scripts in `scripts/` (`pb-browse`, `pb-qa`, `pb-pop`, `pb-prune-tests`) for deterministic browser and file-system work.

```
pb-suite/
  commands/          source markdown — one file per command
  scripts/
    browse.ts        pb-browse: URL → markdown via Playwright + Turndown
    qa.ts            pb-qa: visit routes, capture console/network errors, screenshots
    prune-tests.ts   pb-prune-tests: detect broken imports, all-skipped files
    pop.ts           pb-pop: URL/file → SEO signals (schema, headings, meta, structure)
    lib/
      bootstrap.sh   single entry point — sets $PB_SUITE, sourced by commands
      cil.sh         opt-in CIL helpers, no-op outside CIL repos
      scope.sh       shared diff-scope detection for commands that read a diff
  references/        editable knowledge bases read by commands at runtime
    ai-writing-signals.md  pb-copy AI-slop ruleset — tells, confidence gate, vocab list
    house-review-lens.md   shared cold-target-user review lens for pb-copy/pb-design-review/pb-pop
    seo-signals.md   pb-pop scoring rules — weights, bands, schema catalog, sector strictness
  tests/             bash smoke tests for install mechanics and content invariants
  install            symlink commands/ into ~/.claude/commands/, install deps
  uninstall          remove only symlinks that point back to this repo
  package.json       Bun dependencies for the helper scripts
  VERSION            semver string
  CHANGELOG.md       newest-first version history
```

## Install

```bash
./install
```

What it does:

1. Symlinks `commands/pb-*.md` and `commands/pb.md` into `~/.claude/commands/` (idempotent; backs up pre-existing regular files as `<name>.bak.<timestamp>`).
2. Symlinks `scripts/lib/bootstrap.sh` to `~/.claude/commands/pb-bootstrap.sh` so commands can resolve `$PB_SUITE` with a single `source` line.
3. Runs `bun install` if `node_modules/` is missing (required by the Bun helper scripts).
4. Runs `bunx playwright install chromium` if the Chromium bundle is missing (~150MB, one-time; used by browser-backed helpers such as `pb-browse`, `pb-qa`, and `pb-pop`).

First run takes ~30s for the Chromium download. Subsequent runs are instant.

### Codex skills

Codex skills use a different format from Claude Code slash commands. The
Codex-native ports live in `codex-skills/<name>/SKILL.md`. Install them as
symlinks with:

```bash
./install-codex
```

The installer links each complete skill directory into `~/.codex/skills/`.
Editing a source `SKILL.md` therefore changes the installed skill immediately
on disk. Start a fresh Codex agent or session after an edit so it reloads the
skill instructions. `./uninstall-codex` removes only symlinks that point back
to this repository.

Use `CODEX_HOME` to select a different Codex home directory, or
`CODEX_SKILLS_DIR` to select the exact target directory.

Every pb-suite command has a Codex skill adapter. The adapter reads the
matching canonical source in `commands/` at execution time, so command-source
updates apply to new Codex sessions without re-porting the procedure. The
adapter explains the small differences in tool naming, arguments, and nested
skill calls. `pb-design-review` additionally has a Codex-specific detailed
review layer.

Custom install location:

```bash
CLAUDE_COMMANDS_DIR=/some/other/path ./install
```

Uninstall:

```bash
./uninstall
```

Only touches symlinks pointing back into this repo — foreign symlinks and regular files are left alone.

## Command guard (opt-in)

Every merge-adjacent command already refuses `--no-verify`, `--force`, and friends. That is a rule the model is asked to follow. The command guard is the layer that enforces it instead:

```bash
./install --hooks
```

This wires `hooks/deny-dangerous.sh` as a `PreToolUse` hook on `Bash` in `~/.claude/settings.json`. A matching command exits 2 before it runs, and the agent is told not to retry or reword it. The guard reads `hooks/dangerous-patterns.txt` from beside itself, so editing that file takes effect on the next command — no reinstall, and no second copy to drift out of sync.

It is the only part of pb-suite that changes how the agent runs rather than what it reads, which is why it is opt-in rather than default.

What it blocks: `rm -rf` aimed at `/`, `~`, or `/Users`; raw-disk writes and formatting; `sudo rm`; fork bombs; `curl | sh`; `git push --force`; remote branch deletion; reflog destruction; `gh repo delete`, secret/key deletion, `gh api -X DELETE`, `gh auth token`.

What it deliberately allows: `rm -rf node_modules`, `git push --force-with-lease`, `git gc --prune=2.weeks.ago`, `chmod -R 755 dist`. Locally destructive but recoverable stays allowed — a guard that blocks routine work gets switched off, and a switched-off guard blocks nothing.

Two limits worth stating plainly:

- **It is a seatbelt, not a sandbox.** A regex denylist stops an accident. It does not stop a determined agent: `python -c "shutil.rmtree(...)"` or a base64'd script walks straight past it.
- **It fails open.** No `jq`, or no patterns file, means every command is allowed. A guard that hard-blocks the moment a dependency goes missing gets uninstalled the same day.

Known over-block: `git push --dry-run --force` is blocked. Excluding it needs a negative lookahead that POSIX ERE does not have, and the command is rare enough that the false positive is cheaper than the machinery.

Adding a pattern: write POSIX ERE (`grep -E`), use `[[:space:]]` rather than `\s`, allow an optional `([A-Za-z0-9._/-]*/)?` path prefix so `/bin/rm` is caught alongside `rm`, and add both a block case and an allow case to the guard section of `tests/smoke.sh` before committing. The allow cases are what keep the guard usable.

Codex is not wired automatically. Add the same entry to `~/.codex/hooks.json`:

```json
{"hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "/absolute/path/to/pb-suite/hooks/deny-dangerous.sh"}]}]}}
```

Codex pins hook trust by hash, so after editing that entry you must run `/hooks` in Codex and re-trust it — otherwise Codex silently skips the guard. That interactive step is why `install-codex` does not do this for you. Use an absolute path; `~` expansion is not reliable across agents.

Uninstall removes only pb-suite's own hook entry and leaves any other hook in place.

## Editing and extending

Edit the source files in `commands/`. The symlinks in `~/.claude/commands/` point directly at these files, so every change is live in the next command session immediately — no re-install needed.

To add a new command, drop `commands/pb-<name>.md` and run `./install` to symlink it.

To add a Codex port, create `codex-skills/pb-<name>/SKILL.md` with Codex skill
frontmatter and run `./install-codex`. A Claude command is not automatically a
Codex skill: port its instructions deliberately, including any tool-specific
steps and references to other slash commands.

### File conventions

- Compact: ~70 lines, 5–7 numbered steps.
- Frontmatter with `description` and `allowed-tools`; `argument-hint` if it takes args.
- Reuse the severity model below — do not invent new severity tiers.
- If the command reads a diff, source `scripts/lib/scope.sh` to get the standard scope-detection logic.
- Respect per-project `CLAUDE.md`. Do not hard-code style rules that belong in a project's own instructions.
- Volatile rules that change as insights arrive (scoring weights, signal lists) belong in a dated `references/*.md` file the command reads at runtime — not baked into the skill body. `/pb-pop` does this with `references/seo-signals.md`; `/pb-evolve` can propose edits to it.
- No telemetry, no session state, no update checks.

## Commands

Commands are grouped by workflow area. Full instructions live in the corresponding file under `commands/`.

**Reviewing and shipping**

| Command | Purpose |
|---|---|
| `/pb-review` | Pre-landing code review against the diff — correctness, safety, completeness, tests. |
| `/pb-design-review` | UI review combining Refactoring UI principles, structured visual critique, and the suite severity model. Diff pass + optional live-URL screenshot critique. |
| `/pb-cso` | Pre-launch security audit (OWASP Top 10 + STRIDE) with a confidence gate. `--diff` for changed-files-only. |
| `/pb-copy` | Copywriting review/rewrite. Strips AI-slop, enforces `CLAUDE.md` brand-tone, applies one framework per surface (AIDA/PAS/FAB/BAB). Modes: rewrite / critique / generate / brand-check. |
| `/pb-pop` | PageOptimizer-Pro-style SEO / AI-citability audit. Scores a page 0-100 (keyword placement, schema, semantic terms, structure, internal links, depth, E-E-A-T) benchmarked against the pages ranking for the target query. Report-only — schema gaps emit paste-ready JSON-LD, prose gaps hand off to `/pb-copy`. `--blueprint` specs a new page; `--no-benchmark` for absolute scoring. Rules live in `references/seo-signals.md`. |
| `/pb-check` | Single-call orchestrator: runs pb-review + pb-design-review (if UI) + pb-cso `--diff` + pb-qa (if URL given), aggregates findings, surfaces cross-PR patterns. Audit only — no merge, no test runs. |
| `/pb-ship` | Pre-merge gate: pb-review + `e2e-from-pr` verify, classifies each new spec (`persist` / `revert` / `ask`), ship/wait/decide prompt. Never auto-merges. On the ship path, follows the merge commit through CI, deployment, and an optional declared health check (`--no-follow` to skip). Refuses `--no-verify`, `--no-gpg-sign`, `--force`. |
| `/pb-pr` | Drafts a PR description from the branch diff. Reads `CLAUDE.md` for tone, fills `.github/pull_request_template.md` if present. User picks open / draft / revise / copy / cancel. Pass `--prepare` to write the draft to `.context/pr-draft.md` + clipboard instead of opening a PR directly. |

**Investigating and auditing**

| Command | Purpose |
|---|---|
| `/pb-investigate` | Root-cause debugging. Iron law: no fix without reproduction and hypothesis. Three failed fixes triggers a step back. Optionally appends a one-liner to `.claude/incidents.md`. |
| `/pb-audit` | Adversarial read-only audit of existing stable code (no diff). Behavior inventory + coverage map + testability + OWASP + GDPR + defect register. Modes: A (audit) / B (audit + characterization plan) / C (inventory backfill). |
| `/pb-qa` | Runtime QA — visits routes via headless Chromium, captures console errors, 5xx responses, broken images. Per-route screenshots. Read-only. |
| `/pb-browse` | Fetch a URL via headless Chromium, return clean markdown via Turndown. Self-contained — no external fetch connector required. Optional screenshot. |
| `/pb-env-check` | Diff `.env.example` vs local env files vs hosted environment keys. Flags missing, undocumented, prod-only, leaked. Keys only — never prints values. |
| `/pb-decisions` | Names the judgment calls around the current work, at three points on one timeline. `--now`: the 1-3 consequential choices hidden in something just proposed, answered instantly from the gut with no tool use. `--next`: unresolved choices drilled one at a time, recommendation first. Default: choices already made that the agent is genuinely unsure about, with the alternative not taken and a strict-bucket escalation. Read-only — it never applies a decision. |
| `/pb-prune-tests` | Audit the test suite for likely-obsolete specs: broken imports, all-skipped files, references to long-merged PRs. Report only — no deletions without explicit approval. |

**Development discipline**

| Command | Purpose |
|---|---|
| `/pb-implement` | Spec-first feature implementation — the orchestration layer that drives the rest of the suite. Builds a written spec, prompts when context is thin, declares a verification plan *before* coding, routes specialist reviews by what the change touches (`/pb-cso --diff`, `/pb-design-review`, `/pb-copy`, `/pb-env-check` via the `CLAUDE.md` trigger table), gates strict-bucket work behind explicit human approval, then drives every slice through `/pb-tdd`'s RED→GREEN→REFACTOR loop in parallel waves when safe. Stuck slices escalate to `/pb-investigate`; review uses `/pb-check` plus an independent second pass; recurring patterns feed `.claude/lessons.md` / `.claude/incidents.md` (→ `/pb-evolve`). `--spec <file>` / `--interview` / `--plan-only` / `--no-parallel`. |
| `/pb-tdd` | Test-first workflow. Greenfield (RED→GREEN→REFACTOR) or brownfield (CHARACTERIZE→RED→GREEN→REFACTOR), auto-detected. Risk buckets — strict for money/privacy/auth/AI/retention/evaluation, light for routine CRUD, skip for docs. One vertical slice per call. `--auto` infers the slice from working tree + branch + recent commits. |

**Suite management and cross-project**

| Command | Purpose |
|---|---|
| `/pb-init` | Opt a project into pb-suite. Adds gitignore entries for `.pb-qa/` / `.pb-design-review/` / `.pb-browse/`, offers to create `.claude/lessons.md` and `.claude/incidents.md`, scaffolds a `CLAUDE.md` skeleton if missing. Per-item `AskUserQuestion`. Idempotent. |
| `/pb-rules` | Inject or update the canonical pb-suite Workflow block (trigger table, risk buckets, severity model) in a `CLAUDE.md`. Per-repo default; `--global` writes to `~/.claude/CLAUDE.md`. Single source of truth — re-run after suite updates. |
| `/pb-handoff` | Compacts the session into a handoff a fresh agent can act on — decisions and why, dead ends already hit, uncertain calls, open work as state. Writes `.context/handoff.md` (`--repo` for a committed `HANDOFF.md`) and prints a paste-ready block. State, never instructions; references artifacts instead of re-embedding them. |
| `/pb-resume` | "Where was I?" for one repo — git state, recent activity, open PRs, CI status, suggested next step. Solo-founder context recovery after an interruption. |
| `/pb-across` | Run a shell or `/pb-*` command across every project one level deep in `Projects/Active/` (handles nested repos like `Group/repo`). Filter / parallel / summary modes. |
| `/pb-evolve` | Reads `.claude/lessons.md` and `.claude/incidents.md`, clusters recurring patterns at n≥3, proposes surgical edits to pb-* skills. Never auto-applies. `--global` for cross-repo signal, `--apply` to commit changes. The only command that edits the suite itself. |
| `/pb` | Discovery index. Prints the trigger table + every installed pb-* command with its description + repo signals (CIL? `CLAUDE.md`? load-bearing block? opt-ins?) + a one-line suggested next step from git state. Read-only. |

## CIL integration (opt-in, auto-detected)

When a repo has a top-level `CIL/sources.md`, some pb-* commands automatically enable a CIL bridge:

- `/pb-resume` — adds assigned tracker items and recent specs. `--no-cil` to suppress.
- `/pb-pr` — extracts a tracker key from the branch name (e.g. `ABC-123-foo`), seeds the summary from the matching ticket, appends `Closes <KEY>`.
- `/pb-ship` — the gate splits into ship / wait / defer / decide. `defer` opens a follow-up ticket when supported; `decide` stays for genuinely strategic choices (cil-decide enforcement). Exit-readiness forced-read prompt on external-surface / load-bearing / legal / billing / auth diffs.
- `/pb-cso` — canonical-narrative check: when `CLAUDE.md` declares a narrative (e.g. privacy-first) and the diff adds external-surface copy, flags a missing concrete claim (IMPORTANT) or contradictory copy (BLOCKER).
- `/pb-evolve --cil` — reads `CIL/improvements/*.md` and `CIL/incidents.md` in addition to the `.claude/*.md` artifacts.

Outside a CIL repo all of the above no-op. No external connector is required; if tracker/spec context is unavailable, the bridge drops silently and the command continues.

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

## Notes for maintainers

If you are editing this repo:

- **Don't invent commands.** The slash-command list in this README is the full set. If a workflow needs something missing, it's a feature request, not a runtime detail.
- **Source the canonical workflow rules from `/pb-rules`**, not from this README. The injected Workflow block in a downstream project's `CLAUDE.md` is the contract — this README is documentation.
- **Editing a command? Match the existing conventions** (frontmatter, ~70 lines, numbered steps, severity tiers, scope-detection via `scope.sh`). Don't introduce new severity levels or new orchestration patterns without discussing first.
- **Test changes** with `./tests/smoke.sh` after editing. The smoke tests cover install/uninstall mechanics and content invariants on the command files — they don't cover subjective command interpretation.
- **`$PB_SUITE`** inside a command resolves via `source ~/.claude/commands/pb-bootstrap.sh`. Honor `PB_SUITE_HOME` if set (testing, non-standard installs).
- **Refusal flags are non-negotiable.** `/pb-ship`, `/pb-pr`, and any merge-adjacent command refuse `--no-verify`, `--no-gpg-sign`, `--force`, `-f`. Do not soften these.

## Tests

```bash
./tests/smoke.sh
```

Covers install/uninstall mechanics, `$PB_SUITE` resolution, presence of refuse-flag patterns, canonical headings in skill files, and embedded-bash refuse conditions. Exit 0 = pass. See `tests/README.md` for what is intentionally not covered.

## Out of scope

No telemetry, no hidden background service, no pre-flight bash that mutates config state. If a future need requires heavier browser automation (anti-bot, headed mode, long-lived daemon), that becomes a deliberate addition under `scripts/` — not a meta-layer over an external tool.

## Related Work

- [Pixelbrew Studio](https://pixelbrew.studio) - independent product lab for small tools and public experiments.
- [quote-locator](https://github.com/pixelbrew-studio/quote-locator) - TypeScript utility for locating claimed quotes inside source text.
- [eval-metrics-ts](https://github.com/pixelbrew-studio/eval-metrics-ts) - dependency-light metrics for classification and ranking evaluations.
