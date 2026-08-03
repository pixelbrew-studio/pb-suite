---
description: Print the pb-suite trigger table for the current repo. Cheap discovery — which pb-* command runs for which kind of change.
allowed-tools: [Bash, Read]
argument-hint: "(no arguments)"
---

# pb

Discovery index for pb-suite. Prints the canonical trigger table from `pb-rules` plus a one-line description for every installed `pb-*` command. Read-only.

Useful when you have a change in flight and you are not sure which pb-* command applies, or when onboarding to a repo that already has pb-suite wired in.

## Steps

### 1. Locate suite + repo

```bash
source "$HOME/.claude/commands/pb-bootstrap.sh"
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")
```

### 2. Trigger table

If the repo's `CLAUDE.md` has a `## Workflow (pb-suite)` block, print that — it is the single source of truth for this repo. Otherwise extract the canonical block from `$PB_SUITE/commands/pb-rules.md` and print that.

### 3. Command index

List every `pb-*.md` in `$PB_SUITE/commands/` with its `description:` frontmatter, one per line, alphabetical:

```
pb-audit         Adversarial audit of stable code…
pb-browse        Fetch a URL via headless Chromium…
…
```

### 4. Repo signals

In one block, print what is detected:

- Is this a CIL repo? (`CIL/sources.md` present)
- Does `CLAUDE.md` exist? Does it have a `## Workflow (pb-suite)` block?
- Does `CLAUDE.md` declare load-bearing files? (`## pb-suite: load-bearing files` present)
- Are `.claude/lessons.md` / `.claude/incidents.md` opted in?
- Detected stack (one line from `package.json` / `pyproject.toml` / `go.mod` etc.)
- Command guard status (see below)

### 4b. Command guard status

The guard is an absolute path recorded in `settings.json`. Move, rename, or delete the checkout it points at and the hook stays listed while blocking nothing — installed, visible, inert. Nothing surfaces that on its own, so report it here:

```bash
GUARD=$(jq -r '[.hooks.PreToolUse[]? | select(.matcher == "Bash") | .hooks[]?.command]
               | map(select(test("deny-dangerous")))[0] // empty' ~/.claude/settings.json 2>/dev/null)
```

- Empty → `command guard: not wired (./install --hooks to enable)`
- Set, and the file is executable, and `printf '{"tool_input":{"command":"rm -rf /"}}' | "$GUARD"` exits 2 → `command guard: active`
- Set but the path is missing, not executable, or the probe does not exit 2 → `command guard: WIRED BUT INERT — <path>`. Flag it; this is the state that looks protected and is not.

Codex is wired separately in `~/.codex/hooks.json` and pins trust by hash, so a listed entry there can still be skipped until re-trusted with `/hooks`. Report its presence, and say that presence alone does not prove it runs.

### 5. Next step

Single sentence — read the working tree state via `git status -s`:

- Untracked + uncommitted → "Likely next: `/pb-review`, then `/pb-pr`."
- Clean, ahead of upstream → "Likely next: `/pb-ship`."
- Clean, behind/no branch divergence → "Likely next: `/pb-resume` to see what changed while you were away."

## What this command does NOT do

- Not a runner — `/pb` does not execute other pb-* commands, it only describes them.
- Not a configurator — for that, `/pb-init` and `/pb-rules`.
- Not a status dashboard — for that, `/pb-resume` (per repo) or `/pb-across` (portfolio).
