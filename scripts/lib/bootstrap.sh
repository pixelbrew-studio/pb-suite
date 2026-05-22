#!/usr/bin/env bash
# pb-suite bootstrap — single entry point for common helpers across skills.
#
# Usage:
#   source "$HOME/.claude/commands/pb-bootstrap.sh"
#   # then, if the skill reads a diff:
#   source "$PB_SUITE/scripts/lib/scope.sh"
#
# Sets:
#   PB_SUITE — absolute path to the pb-suite repo root.
#
# Honors PB_SUITE_HOME as an override (testing, non-standard install).

if [ -n "${PB_SUITE_HOME:-}" ] && [ -d "$PB_SUITE_HOME" ]; then
  PB_SUITE="$PB_SUITE_HOME"
else
  _pb_boot="$HOME/.claude/commands/pb-bootstrap.sh"
  _pb_target=$(readlink "$_pb_boot" 2>/dev/null || echo "$_pb_boot")
  # symlink target is <repo>/scripts/lib/bootstrap.sh — three dirnames up to repo root
  PB_SUITE=$(dirname "$(dirname "$(dirname "$_pb_target")")")
  unset _pb_boot _pb_target
fi
export PB_SUITE
