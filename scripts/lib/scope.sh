#!/usr/bin/env bash
# pb-suite scope detection — single source of truth.
#
# Usage: source this file, then read $BASE. Do not execute directly.
#
# Logic: on main/master, diff against upstream (catches unpushed commits).
# On a feature branch, diff against origin/main (catches the whole feature),
# never against @{u} which would be origin/<feature> and produce an empty diff.

PB_SUITE_CURRENT=$(git branch --show-current 2>/dev/null)
if [ "$PB_SUITE_CURRENT" = "main" ] || [ "$PB_SUITE_CURRENT" = "master" ]; then
  BASE=$(git rev-parse --verify @{u} 2>/dev/null || echo "HEAD~1")
else
  BASE=$(git rev-parse --verify origin/main 2>/dev/null \
    || git rev-parse --verify origin/master 2>/dev/null \
    || git rev-parse --verify main 2>/dev/null \
    || git rev-parse --verify master 2>/dev/null \
    || echo "HEAD~1")
fi
unset PB_SUITE_CURRENT
export BASE
