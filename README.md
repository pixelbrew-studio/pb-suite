# pb-suite

Lichte vervanger voor Garry Tan's gstack — een hand-picked set Claude Code slash-commands voor Karel's solo-workflow. Geen telemetrie, geen multi-agent dispatch, geen specialist-roleplay. Wel: gerichte checks, transparante severity, en respect voor per-project `CLAUDE.md`.

## Commands

| Command | Doel |
|---|---|
| `/pb-review` | Pre-landing code review — correctness, safety, completeness, tests |
| `/pb-design-review` | Pre-landing UI review — a11y, hierarchy, spacing, typography, AI-slop |
| `/pb-investigate` | Root-cause debugging — iron law: no fix without investigation |
| `/pb-cso` | Pre-launch security audit — OWASP top 10 + STRIDE met confidence-gate |
| `/pb-ship` | Pre-merge orchestrator — pb-review + e2e-from-pr verify-mode + ship/wait/decide gate, nooit auto-merge |

## Verify vs regress (pb-ship)

`e2e-from-pr` schrijft tests standaard naar de permanente suite — die groeit dan monotoon en CI wordt traag. `/pb-ship` lost dat op door twee modes:

- **default (verify)** — specs draaien één keer en worden gerevert. De regression-suite blijft de grootte die hij was.
- **--regress** — specs landen permanent. Bewuste keuze voor features die echt long-lived coverage nodig hebben.
- **--dry** — alles draaien, geen merge-prompt.

Verify-mode vereist een clean working tree (de revert-stap leunt erop).

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

Lokaal symlinken naar `~/.claude/commands/`:

```bash
./install
```

Dat is idempotent. Bestaande regular files worden gebackupt naar `<naam>.bak.<timestamp>` voor het symlinken. Deinstalleren met `./uninstall` (raakt alleen symlinks die naar deze repo wijzen).

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

Geen multi-agent dispatch, geen learning-files, geen "specialist personas", geen pre-flight bash met config-state. Als je dat wil, gebruik gstack zelf.
