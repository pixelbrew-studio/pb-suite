#!/usr/bin/env bash
# pb-suite CIL integration helpers — opt-in, no-op when not in a CIL repo.
#
# A "CIL repo" is any git repo containing a top-level CIL/sources.md.
# Skills source this and call the helpers; they degrade to no-op outside CIL.
#
# Usage:
#   source "$PB_SUITE/scripts/lib/cil.sh"
#   if cil_repo_p; then ... fi
#   TICKET=$(cil_linear_ticket_from_branch "$BRANCH")
#   cil_external_surface_p "apps/landing/app/page.tsx" && ...

cil_repo_p() {
  local root
  root=$(git rev-parse --show-toplevel 2>/dev/null) || return 1
  [ -f "$root/CIL/sources.md" ]
}

# Extract Linear ticket key (e.g. ABC-123) from a branch name.
# Accepts: abc-123-foo, ABC-123/foo, feat/abc-123-foo, foo-abc-123, ABC123-foo.
# Echoes the uppercase key or nothing.
cil_linear_ticket_from_branch() {
  local branch="$1"
  local key
  key=$(printf '%s\n' "$branch" | grep -oiE '\b[a-z]{2,5}[-]?[0-9]{1,5}\b' | head -1)
  [ -z "$key" ] && return 0
  printf '%s\n' "$key" | tr '[:lower:]' '[:upper:]' | sed 's/^\([A-Z]*\)\([0-9]\)/\1-\2/'
}

# Does this path live on an external (user/regulator-facing) surface?
# Used by pb-cso to gate the "canonical narrative claim present?" check
# and by pb-pr / pb-ship to escalate exit-readiness prompts.
cil_external_surface_p() {
  case "$1" in
    marketing/*|*/marketing/*|landing/*|*/landing/*|apps/landing*|apps/*marketing*) return 0;;
    *'(marketing)'/*) return 0;;
    privacy/*|*/privacy/*|*privacy-policy*|*subprocessor*|*terms*) return 0;;
    legal/*|*/legal/*) return 0;;
    blog/*|*/blog/*|docs/*|*/docs/*) return 0;;
  esac
  return 1
}

# Read the canonical "## pb-suite: load-bearing files" block from CLAUDE.md.
# Emits one path/glob per line. Empty when missing.
pb_load_bearing_paths() {
  local f="${1:-CLAUDE.md}"
  [ -f "$f" ] || return 0
  awk '
    /^## pb-suite: load-bearing files/ { in_block=1; next }
    in_block && /^## / { in_block=0 }
    in_block && /^- / { sub(/^- /,""); print }
  ' "$f"
}

# Does this path match one of the load-bearing paths/globs in CLAUDE.md?
pb_load_bearing_p() {
  local path="$1" pattern
  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    case "$path" in $pattern) return 0;; esac
  done < <(pb_load_bearing_paths)
  return 1
}
