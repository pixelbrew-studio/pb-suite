#!/usr/bin/env bash
# pb-suite command guard. Blocks irreversible shell commands before an agent
# runs them. Wired as a PreToolUse hook by `./install --hooks` (Claude Code) and
# documented for Codex in README.md.
#
# Adapted from davidondrej/skills (MIT) — see NOTICE.
#
# stdin:  hook JSON. Claude Code and Codex put the command at .tool_input.command;
#         some Claude-compatible CLIs use .toolInput.command.
# block:  exit 2 with the reason on stderr (the Claude/Codex hook contract).
# allow:  exit 0, silent.
#
# This is a seatbelt against accidents, NOT a sandbox against a hostile agent.
# An obfuscated equivalent (`python -c "shutil.rmtree(...)"`, a base64'd script)
# walks straight past a regex denylist. Treat it accordingly.

# Resolved next to this script, so the guard and its denylist can never drift
# apart — a hook wired to a custom install path would otherwise look for the
# patterns under $HOME, not find them, and silently allow everything.
GUARD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATTERNS_FILE="${PB_GUARD_PATTERNS:-$GUARD_DIR/dangerous-patterns.txt}"

# Without jq the command cannot be inspected. Fail OPEN: a guard that blocks
# every command the moment a dependency is missing gets uninstalled the same day.
command -v jq >/dev/null 2>&1 || exit 0
[ -f "$PATTERNS_FILE" ] || exit 0

CMD=$(jq -r '.tool_input.command // .toolInput.command // empty' 2>/dev/null)
[ -z "$CMD" ] && exit 0

while IFS= read -r pattern; do
  case "$pattern" in ''|\#*) continue ;; esac
  if printf '%s\n' "$CMD" | grep -qE -- "$pattern" 2>/dev/null; then
    echo "Blocked by the pb-suite command guard ($PATTERNS_FILE). Matched pattern: $pattern. Do not retry it, do not work around it, and do not rewrite it into an equivalent that evades the pattern. Explain the block to the user instead." >&2
    exit 2
  fi
done < "$PATTERNS_FILE"

exit 0
