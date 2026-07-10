#!/usr/bin/env bash
# Resolve the pb-suite checkout from the Codex installer symlink.

set -euo pipefail

if [ -n "${PB_SUITE_HOME:-}" ]; then
  PB_SUITE="$PB_SUITE_HOME"
else
  if [ -n "${BASH_SOURCE:-}" ]; then
    SOURCE="${BASH_SOURCE[0]}"
  elif [ -n "${ZSH_VERSION:-}" ]; then
    SOURCE="${(%):-%N}"
  else
    echo "pb-suite Codex: cannot resolve the sourced bootstrap path" >&2
    return 1 2>/dev/null || exit 1
  fi
  while [ -L "$SOURCE" ]; do
    TARGET="$(readlink "$SOURCE")"
    if [[ "$TARGET" = /* ]]; then
      SOURCE="$TARGET"
    else
      SOURCE="$(cd "$(dirname "$SOURCE")" && pwd)/$TARGET"
    fi
  done
  PB_SUITE="$(cd "$(dirname "$SOURCE")/../.." && pwd)"
fi

export PB_SUITE
