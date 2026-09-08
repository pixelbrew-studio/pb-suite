---
description: Brutal, no-holds-barred roast of anything — websites, code, docs, a diff, a PR, an architecture, a pasted pitch. Hands the target to a frontier model on OpenCode (default Grok) as a read-only outside voice, returns sectioned markdown. Complement to /pb-copy (fixes words) and /pb-review (finds bugs) — /pb-roast questions whether the thing should exist in the shape it's in.
allowed-tools: [Bash, Read, Write, AskUserQuestion]
argument-hint: "<target> [--kind auto|url|file|dir|diff|pr|text] [--pages url,...] [--model provider/model] [--out path] [--tone brutal|dry|sober]  (requires PB_ROAST_MODEL env or --model)"
---

# pb-roast

Point it at anything, get an outside-voice roast in the pb-suite house register. Read-only, cross-model on purpose — the authoring model cannot roast its own work honestly.

Use when the thing *works* but doesn't *land* — a landing page that reads like a DPA, a README that buries the product, a schema that solves a problem you don't have, a PR that ships four unrelated ideas. `/pb-copy` fixes sentences, `/pb-review` finds bugs, `/pb-roast` asks whether the thing has a reason to exist in this shape.

## Steps

### 1. Parse arguments

```bash
TARGET=""; KIND="auto"; EXTRA_PAGES=""; MODEL="${PB_ROAST_MODEL:-}"; OUT=""; TONE="brutal"
# ...parse $ARGUMENTS: first non-flag is TARGET; --kind, --pages, --model, --out, --tone flags
# --model overrides PB_ROAST_MODEL for this run.
```

Stop if no target. Stop if `MODEL` is empty after arg parsing — no guessed default; the user pins the id via `PB_ROAST_MODEL` or `--model`. Error message must suggest running `opencode models | grep -i grok` to pick a current Grok id. `--tone dry` softens delivery (still specific), `--tone sober` drops the punchlines entirely (analysis-only). Default `brutal`.

### 2. Resolve the target kind

If `--kind` is set, honour it. Otherwise infer from `TARGET`:

- Starts with `http://` or `https://` → **url**
- Matches `#<n>` or `pr/<n>` or a GitHub PR URL → **pr**
- Equals `diff` / `--diff` / `HEAD` / a ref-range like `main..HEAD` → **diff**
- Is a directory path that exists → **dir**
- Is a file path that exists → **file**
- Starts with `-` or reads as a multi-line block passed inline → **text**
- Otherwise: ask via `AskUserQuestion` which kind it is.

### 3. Locate suite + verify OpenCode

```bash
source "$HOME/.claude/commands/pb-bootstrap.sh"
command -v opencode >/dev/null || { echo "pb-roast: opencode CLI not found in PATH"; exit 1; }
opencode models 2>/dev/null | awk '{print $1}' | grep -Fxq "$MODEL" || {
  echo "pb-roast: model '$MODEL' not in \`opencode models\`. Pick a current id (e.g. \`opencode models | grep -i grok\`) and set PB_ROAST_MODEL or pass --model provider/model."; exit 1; }
```

### 4. Materialize the target

Build one plain-text `material` block. Each kind has its own capture:

- **url** — `bun "$PB_SUITE/scripts/browse.ts" "$TARGET" --full`, then each `--pages` entry. Prefix each with `=== <url> — <title> ===`. Fetch failures: report the URL and continue.
- **file** — read verbatim, prefix `=== file: <path> ===`. Cap at ~200 KB; if larger, truncate tail and note it.
- **dir** — `git ls-files "$TARGET"` (or `find` if not tracked), pick the roast-worthy surface: `README*`, `CHANGELOG*`, `package.json`, top-level source entries, public copy. Concat under `=== dir: <path> — <file> ===` blocks. Skip lockfiles, minified bundles, generated code.
- **diff** — `git diff <range>` (default `origin/main...HEAD`), then `git log --oneline <range>` for context. Prefix `=== diff: <range> ===`.
- **pr** — `gh pr view <n> --json title,body,headRefName` for metadata, `gh pr diff <n>` for changes. Prefix `=== pr #<n>: <title> ===`.
- **text** — use as-is under `=== pasted text ===`.

Refuse if the material is empty after capture.

### 5. Build the roast prompt

Three parts: **task**, **house voice**, **material**.

**Task** — same shape for every kind, the noun swaps by kind:

```
Roast this <kind>. Do not hold back. Be specific — quote the actual text,
name the section or file or line, name the failure mode. Length is whatever
the target earns; a five-page site does not need a fifteen-section roast,
and a three-file diff does not need a novella.

Structure: sectioned markdown, each section a punch. Open with the single
biggest problem. Close with a one-line roast, and — only for url / dir / pr
kinds — an "if it could talk" quote.

Rules:
- Every criticism cites the actual thing you saw. No paraphrase-only critiques.
- No generic advice ("add tests", "improve the hero", "extract a function").
  Say what THIS target did and why THIS target failed.
- Fair game by kind:
    url  — buried value prop, invented jargon, compliance noise, apologetic
           framing, feature grids that lead with furniture.
    file — reinvented stdlib, speculative abstractions, dead flexibility,
           comments that narrate the code, tests that test the mock.
    dir  — README that hides the product, folder structure that predicts
           the wrong future, one-implementation interfaces, config for a
           value that never changes.
    diff — unrelated changes bundled, silent behaviour changes, snapshot
           tests standing in for assertions, TODOs left behind, "cleanup"
           in a feature PR.
    pr   — title that lies about the scope, description that summarises
           what a diff view already shows, test plan that tests the happy
           path only, "small change" doing three things.
    text — vague verbs, unearned superlatives, sentences that could
           describe any product.
- The maker is probably fine. The artefact is what you roast.
```

Add for `--tone dry`: "Delivery is dry, not comedic. Same specificity, less punchline."
Add for `--tone sober`: "Analysis mode. Drop punchlines and closers. Keep the specificity."

**House voice** — short style anchor: sectioned with `##`, one idea per section, quotable, willing to be mean about work but never about people, no emoji, no hedging language ("it might be worth considering..." → cut).

**Material** — the block from step 4.

### 6. Dispatch through OpenCode

Read-only `plan` agent so the model cannot touch the working tree:

```bash
opencode run --agent plan --model "$MODEL" --dir "$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")" "$PROMPT"
```

Refuse to run if a local `plan` override grants write tools (same check `pb-implement` uses). If OpenCode returns non-zero or empty output, report the failure and stop — do not fall back to Claude. The whole point is an outside voice.

### 7. Save + present

Default output path: `.pb-roast/roast-<slug>-<yyyy-mm-dd>.md`, where `<slug>` is the URL host, file basename, dir name, ref range, PR number, or `text` — whatever fits. Create the dir; append `.pb-roast/` to `.gitignore` if not present (also covered by `/pb-init` for freshly-initialized repos). Override with `--out`.

Write, then print:

```
pb-roast: done
  Target:  <target>
  Kind:    <resolved kind>
  Model:   <resolved provider/model>
  Tone:    brutal | dry | sober
  Saved:   <path>

--- roast ---

<roast content>
```

Do not summarise — the roast is the deliverable.

## Chaining

`/pb-roast` is diagnostic. Typical follow-ups by kind:

- **url** → strategy edits are a human call; copy edits go to `/pb-copy --mode rewrite`; redesigns go to `/pb-design-review`.
- **file / dir** → simplification goes to `/ponytail-review` or `/pb-audit`; correctness goes to `/pb-review`.
- **diff / pr** → same as file/dir on the changed surface; if the roast lands, consider splitting the PR before `/pb-ship`.
- **text** → `/pb-copy --mode rewrite` on the source file the text lives in.

Add to `CLAUDE.md` trigger table via `/pb-rules` — the canonical row is:
`Need an outside voice (site / file / diff / PR / pitch) | /pb-roast <target>`.

## What this command does NOT do

- Not a fixer — outputs a roast, not a diff. Follow with the kind-appropriate command above if you want edits.
- Not a Claude self-review — refuses to fall back to the authoring model on OpenCode failure. Cross-model independence is the entire point.
- Not multi-flow — one target per call. Roast several things, run it several times.
- Not tone-neutral — even `--tone sober` is direct. If you want gentle, use `/pb-copy --mode critique` or `/pb-review`.
