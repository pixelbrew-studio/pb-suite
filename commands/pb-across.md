---
description: Run a shell command or pb- command across every project in Active/. Cross-portfolio dashboard substitute for the solo founder. Walks one level deep to catch nested repos like Salmon Rushhour/repo.
allowed-tools: [Bash, Read]
argument-hint: "<command>  [--in <dir>] [--filter <glob>] [--parallel] [--summary]"
---

# pb-across

Run `<command>` in every detected project under `$PB_PROJECTS_DIR` (default `~/Pixelbrew/Projects/Active`). Per-project header, output, and final summary. Exit non-zero if any project failed.

Read-only mechanics — safety of the run is whatever the passed command is. Don't pass `rm -rf` and expect protection. The destructive-command guard in step 3 is a speed-bump, not a sandbox.

## Steps

### 1. Resolve roots

```bash
ROOT="${PB_PROJECTS_DIR:-$HOME/Pixelbrew/Projects/Active}"
[ -d "$ROOT" ] || { echo "pb-across: $ROOT not found"; exit 1; }
```

Parse `$ARGUMENTS`: the leading positional is `<command>` (may contain spaces, quote it). Flags: `--in <dir>`, `--filter <glob>`, `--parallel`, `--summary`. If `--in` is passed, override `ROOT`.

### 2. Discover projects

A directory is a project if it contains any of: `.git`, `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `deno.json`.

Walk strategy:
1. List top-level dirs in `$ROOT`.
2. If a top-level dir has a project marker → include as project root.
3. If not, walk one level deeper and include each sub-dir that has a marker.
4. Skip dirs named `node_modules`, `.git`, `dist`, `build`, `.next`, `.turbo`, `coverage`, `Archive`, `Templates`, `Output`.

```bash
has_marker() {
  local d="$1"
  for m in .git package.json Cargo.toml pyproject.toml go.mod deno.json; do
    [ -e "$d/$m" ] && return 0
  done
  return 1
}
find_projects() {
  for d in "$ROOT"/*/; do
    [ -d "$d" ] || continue
    case "$(basename "$d")" in node_modules|.git|dist|build|.next|.turbo|coverage|Archive|Templates|Output) continue;; esac
    if has_marker "$d"; then echo "$d"; continue; fi
    for sub in "$d"*/; do
      [ -d "$sub" ] || continue
      case "$(basename "$sub")" in node_modules|.git|dist|build|.next|.turbo|coverage) continue;; esac
      has_marker "$sub" && echo "$sub"
    done
  done
}
```

Apply `--filter <glob>` as a basename match (`case "$basename" in $glob) ... esac`). Glob, not regex.

### 3. Sanity-check the command

If `<command>` starts with `pb-` and `~/.claude/commands/pb-<name>.md` doesn't exist: warn but proceed (might be a script wrapping the convention).

Refuse outright if `<command>` contains any of: `rm -rf`, `git reset --hard`, `git push --force`, `git push -f`, `git clean -fd`, `> /`, `truncate`. Tell the user to confirm and re-run with the literal command they want — pb-across is for portfolio sweeps, not bulk destruction.

### 4. Run

Serial by default. For each project:

```bash
NAME=$(basename "$proj")
echo "=== $NAME ==="
(cd "$proj" && eval "$CMD")
ec=$?
echo "--- exit $ec ---"
```

`--parallel`: same loop with `&` and `wait`, but buffer per-project output to a tempfile and cat in discovery order after all finish. Never interleave streams.

`--summary`: skip the per-project blocks. One line per project — `<name> <pass|fail> <first-line-of-output>`.

### 5. Summarize

```
pb-across: <N projects, K passed, M failed>  cmd=<command>  root=<ROOT>
  Failed:
    - <name>  exit <code>
    - ...
```

Exit `1` if any project's command exited non-zero, else `0`.

## Examples

- `/pb-across "git status -s"` — uncommitted across all
- `/pb-across "git fetch && git rev-list --count HEAD..@{u} 2>/dev/null"` — unpushed/unsynced per repo
- `/pb-across "git log -1 --format='%ar %s'" --summary` — last commit per repo, one line each
- `/pb-across "bun test"` — run tests across all (slow; consider `--parallel`)
- `/pb-across pb-resume --filter "Sendays|Sentinel"` — resume two repos (once `pb-resume` is installed)
- `/pb-across "vercel ls --yes 2>/dev/null | head -5"` — Vercel state per project that's linked

## Out of scope (v1)

- Dependency graph between projects (e.g. "run X in topological order").
- Per-project timeouts. If a command hangs, Ctrl-C and add a timeout to the command itself.
- Output capture/diff across runs. Each invocation is independent.
