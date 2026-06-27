#!/usr/bin/env bash
# pb-suite smoke tests — bash-based assertions covering the install machinery
# and content invariants of the markdown skill files. Not a unit-test
# framework (pb-suite has no runtime code to unit-test); the skills are
# LLM-interpreted markdown, so structural assertions on file contents +
# execution checks on the install/bootstrap layer is the right level.
#
# Usage: ./tests/smoke.sh
# Exit codes: 0 = all pass, 1 = one or more failures.

set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

PASS=0
FAIL=0
FAILED_NAMES=()

assert() {
  local name="$1"
  local cond_exit="$2"
  if [ "$cond_exit" -eq 0 ]; then
    PASS=$((PASS + 1))
    printf '  PASS  %s\n' "$name"
  else
    FAIL=$((FAIL + 1))
    FAILED_NAMES+=("$name")
    printf '  FAIL  %s\n' "$name"
  fi
}

# --- Section: install / uninstall / bootstrap ---

echo "[install/uninstall/bootstrap]"

# Item 1: install runs cleanly and creates pb-bootstrap.sh symlink
./install >/tmp/pb-install.log 2>&1
INSTALL_EXIT=$?
assert "install exits 0" "$INSTALL_EXIT"

[ -L "$HOME/.claude/commands/pb-bootstrap.sh" ]
assert "pb-bootstrap.sh symlink exists" "$?"

[ "$(readlink "$HOME/.claude/commands/pb-bootstrap.sh")" = "$REPO_DIR/scripts/lib/bootstrap.sh" ]
assert "pb-bootstrap.sh symlink resolves to repo bootstrap.sh" "$?"

# Item 2: source bootstrap, verify PB_SUITE
( unset PB_SUITE PB_SUITE_HOME
  source "$HOME/.claude/commands/pb-bootstrap.sh"
  [ "$PB_SUITE" = "$REPO_DIR" ]
)
assert "bootstrap resolves PB_SUITE to repo root" "$?"

# Item 3: PB_SUITE_HOME override
( unset PB_SUITE
  PB_SUITE_HOME=/tmp source "$HOME/.claude/commands/pb-bootstrap.sh"
  [ "$PB_SUITE" = "/tmp" ]
)
assert "PB_SUITE_HOME=/tmp overrides PB_SUITE" "$?"

# Item 4: uninstall then re-install (verifies bootstrap symlink is removed and recreated)
./uninstall >/tmp/pb-uninstall.log 2>&1
[ ! -e "$HOME/.claude/commands/pb-bootstrap.sh" ]
assert "uninstall removes pb-bootstrap.sh symlink" "$?"

./install >/tmp/pb-install-2.log 2>&1
[ -L "$HOME/.claude/commands/pb-bootstrap.sh" ]
assert "install re-creates pb-bootstrap.sh symlink" "$?"

# --- Section: converted skills source bootstrap ---

echo "[skills sourcing pb-bootstrap.sh]"

# Item 14: each of the 7 converted skills contains the source line
for skill in pb-review pb-cso pb-design-review pb-check pb-browse pb-qa pb-prune-tests; do
  grep -q 'source "\$HOME/.claude/commands/pb-bootstrap.sh"' "commands/$skill.md"
  assert "$skill sources pb-bootstrap.sh" "$?"
done

# None of the converted skills should still have the old 3-line readlink dance
for skill in pb-review pb-cso pb-design-review pb-check pb-browse pb-qa pb-prune-tests; do
  ! grep -q 'PB_CMD=.*\.claude/commands/.*\.md' "commands/$skill.md"
  assert "$skill no longer has the old readlink dance" "$?"
done

# --- Section: refuse patterns in body ---

echo "[refuse patterns]"

# Item 15: pb-ship refuses --no-verify / --no-gpg-sign / --force / -f
grep -E '\*" --no-verify "\*\|.*\*" --force "\*' commands/pb-ship.md >/dev/null
assert "pb-ship refuses --no-verify and --force" "$?"

grep -E '\*" --no-gpg-sign "\*' commands/pb-ship.md >/dev/null
assert "pb-ship refuses --no-gpg-sign" "$?"

# Item 11 (partial): pb-pr rejects --no-verify / --force
grep -E '\*" --no-verify "\*' commands/pb-pr.md >/dev/null
assert "pb-pr refuses --no-verify" "$?"

grep -E '\*" --force "\*\|.*\*" -f "\*' commands/pb-pr.md >/dev/null
assert "pb-pr refuses --force / -f" "$?"

# pb-check refuses destructive flags (already in place pre-PR but should still be there)
grep -E '\*" --fix "\*\|.*\*" --write "\*' commands/pb-check.md >/dev/null
assert "pb-check refuses --fix / --write" "$?"

# --- Section: pb-init / pb-rules guard rails ---

echo "[pb-init / pb-rules guards]"

# Item 6: pb-init refuses inside pb-suite — content assertion on the refuse string
grep -q 'pb-init: this is pb-suite itself' commands/pb-init.md
assert "pb-init has 'this is pb-suite itself' refuse" "$?"

# Item 6: simulate by running the embedded check from inside pb-suite
(
  cd "$REPO_DIR"
  [ -f VERSION ] && [ -d commands ] && head -1 README.md 2>/dev/null | grep -q '^# pb-suite'
)
assert "pb-init refuse-condition triggers in pb-suite repo" "$?"

# Item 5 (partial): pb-init scaffold points to /pb-rules
grep -q 'Run /pb-rules' commands/pb-init.md
assert "pb-init scaffold points users to /pb-rules" "$?"

# Item 7: pb-rules tells user to run /pb-init when CLAUDE.md is missing (repo mode)
grep -q 'Run .*/pb-init.* first to scaffold CLAUDE.md' commands/pb-rules.md
assert "pb-rules tells user to run /pb-init when CLAUDE.md missing" "$?"

# Items 8/9/10 (partial): pb-rules has the canonical Workflow block
grep -q '^## Workflow (pb-suite)' commands/pb-rules.md
assert "pb-rules contains canonical '## Workflow (pb-suite)' heading" "$?"

# pb-rules supports --global mode
grep -q -- '--global' commands/pb-rules.md
assert "pb-rules supports --global mode" "$?"

# pb-rules refuses inside pb-suite in repo mode
grep -q 'pb-rules: this is pb-suite itself' commands/pb-rules.md
assert "pb-rules refuses when run from pb-suite (repo mode)" "$?"

# --- Section: pb-evolve guards ---

echo "[pb-evolve guards]"

# Item 13: pb-evolve refuses on dirty PB_SUITE
grep -q 'PB_SUITE has uncommitted changes' commands/pb-evolve.md
assert "pb-evolve refuses on dirty PB_SUITE" "$?"

# Item 12: pb-evolve exits cleanly when no learning artifacts exist
grep -qE 'no artifacts exist|nothing to learn|report cleanly and exit' commands/pb-evolve.md
assert "pb-evolve handles empty learning-artifact case cleanly" "$?"

# pb-evolve excludes itself and shared helpers from candidate skills
grep -q 'pb-evolve.md.*bootstrap.sh.*scope.sh\|bootstrap.sh.*scope.sh' commands/pb-evolve.md
assert "pb-evolve excludes self / bootstrap.sh / scope.sh from candidates" "$?"

# --- Section: pb-investigate step 10 ---

echo "[pb-investigate step 10]"

# Item 16: pb-investigate step 10 mentions opt-in via existing file
grep -A 3 '^### 10\. Persistence' commands/pb-investigate.md | grep -q 'opt-in signal\|already exists\|never create'
assert "pb-investigate step 10 is opt-in only (existing-file check)" "$?"

# Item 16: explicit "do nothing" path when file is absent
grep -A 12 '^### 10\. Persistence' commands/pb-investigate.md | grep -qE 'does not exist.*do nothing|Do not prompt to create'
assert "pb-investigate step 10 does nothing when file is absent" "$?"

# --- Section: VERSION / CHANGELOG ---

echo "[VERSION / CHANGELOG]"

VER="$(cat VERSION | tr -d '[:space:]')"
echo "$VER" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' && grep -q "^## $VER" CHANGELOG.md
assert "VERSION is semver with a matching CHANGELOG entry ($VER)" "$?"

grep -q '^## 0\.5\.0' CHANGELOG.md && grep -q '^## 0\.4\.0' CHANGELOG.md && grep -q '^## 0\.1\.0' CHANGELOG.md
assert "CHANGELOG has 0.5.0, 0.4.0, 0.1.0 entries" "$?"

# --- Section: 0.4.0 CIL integration ---

echo "[CIL integration]"

[ -f scripts/lib/cil.sh ]
assert "scripts/lib/cil.sh exists" "$?"

grep -q '^cil_repo_p' scripts/lib/cil.sh && grep -q '^cil_linear_ticket_from_branch' scripts/lib/cil.sh && grep -q '^cil_external_surface_p' scripts/lib/cil.sh
assert "cil.sh exports the three core helpers" "$?"

# load-bearing helpers
grep -q '^pb_load_bearing_paths' scripts/lib/cil.sh && grep -q '^pb_load_bearing_p' scripts/lib/cil.sh
assert "cil.sh exports load-bearing helpers" "$?"

# Linear key extraction is idempotent (uppercase + hyphen-normalized)
KEY=$(bash -c 'source scripts/lib/cil.sh; cil_linear_ticket_from_branch eva-198-some-feature')
[ "$KEY" = "EVA-198" ]
assert "cil_linear_ticket_from_branch normalizes 'eva-198-...' to 'EVA-198'" "$?"

# Suite-level wiring
grep -q '/pb-ship.md\|pb-ship.md' commands/pb-ship.md 2>/dev/null  # sanity
grep -q 'pb_load_bearing_p\|pb_load_bearing_paths\|canonical .## pb-suite: load-bearing files. block' commands/pb-ship.md
assert "pb-ship references canonical load-bearing block" "$?"

grep -q 'defer' commands/pb-ship.md && grep -q 'decide' commands/pb-ship.md
assert "pb-ship gate has defer + decide options" "$?"

grep -q 'exit-readiness' commands/pb-ship.md
assert "pb-ship has exit-readiness prompt" "$?"

grep -q 'cil_linear_ticket_from_branch\|TICKET=' commands/pb-pr.md
assert "pb-pr extracts tracker key from branch" "$?"

grep -q 'cil_repo_p\|CIL_ACTIVE' commands/pb-resume.md
assert "pb-resume has CIL bridge" "$?"

grep -q 'canonical-narrative\|canonical narrative' commands/pb-cso.md
assert "pb-cso has canonical-narrative check" "$?"

grep -q '## pb-suite: load-bearing files' commands/pb-rules.md
assert "pb-rules documents load-bearing block" "$?"

grep -q -- '--cil' commands/pb-evolve.md
assert "pb-evolve accepts --cil flag" "$?"

[ -f commands/pb.md ]
assert "pb.md (discovery index) exists" "$?"

grep -q 'pb\.md\|pb\.md$' install
assert "install picks up pb.md" "$?"

# --- Section: 0.5.0 pb-pop ---

echo "[pb-pop]"

[ -f commands/pb-pop.md ]
assert "pb-pop.md skill exists" "$?"

head -20 commands/pb-pop.md | grep -q '^# pb-pop'
assert "pb-pop.md has canonical '# pb-pop' heading" "$?"

grep -q 'source "\$HOME/.claude/commands/pb-bootstrap.sh"' commands/pb-pop.md
assert "pb-pop sources pb-bootstrap.sh" "$?"

[ -f scripts/pop.ts ]
assert "scripts/pop.ts extractor exists" "$?"

# pop.ts must KEEP what browse.ts strips — assert it reads JSON-LD + meta
grep -q 'application/ld+json' scripts/pop.ts && grep -q 'meta\[name="description"\]' scripts/pop.ts
assert "pop.ts extracts JSON-LD schema + meta description" "$?"

# pop.ts checks AI-crawler access (robots.txt) + extractability sections
grep -q 'robots.txt' scripts/pop.ts && grep -q 'GPTBot' scripts/pop.ts && grep -q 'aiAccess' scripts/pop.ts
assert "pop.ts checks AI-crawler access via robots.txt" "$?"

grep -q 'sections' scripts/pop.ts
assert "pop.ts returns sections[] for passage extractability" "$?"

# skill exposes the AI-citation features
grep -q -- '--cite-check' commands/pb-pop.md
assert "pb-pop has --cite-check mode" "$?"

grep -qi 'AI-access gate\|AI-crawler access\|aiAccess' commands/pb-pop.md
assert "pb-pop has the AI-crawler access gate" "$?"

grep -qi 'extractability' commands/pb-pop.md
assert "pb-pop scores passage extractability" "$?"

grep -qi 'extractability' references/seo-signals.md && grep -q 'AI-crawler access' references/seo-signals.md
assert "seo-signals.md documents extractability + AI-access gate" "$?"

[ -f references/seo-signals.md ]
assert "references/seo-signals.md knowledge base exists" "$?"

# Knowledge base drives scoring — weights + bands present
grep -q 'Weight' references/seo-signals.md && grep -qE 'Critical|Strong' references/seo-signals.md
assert "seo-signals.md has weights and band thresholds" "$?"

# Skill reads the KB rather than hardcoding scoring
grep -q 'references/seo-signals.md\|seo-signals.md' commands/pb-pop.md
assert "pb-pop reads references/seo-signals.md" "$?"

# pb-pop is report-only (no Edit/Write in allowed-tools)
! grep -E '^allowed-tools:.*\b(Edit|Write)\b' commands/pb-pop.md >/dev/null
assert "pb-pop is report-only (no Edit/Write tools)" "$?"

# Wiring: trigger row, evolve target, README index
grep -q 'pb-pop' commands/pb-rules.md
assert "pb-rules has a pb-pop trigger row" "$?"

grep -q 'pb-pop' commands/pb-evolve.md && grep -q 'seo-signals.md' commands/pb-evolve.md
assert "pb-evolve can target pb-pop / seo-signals.md" "$?"

grep -q '/pb-pop' README.md
assert "README lists /pb-pop" "$?"

# --- House review lens (references/house-review-lens.md) ---

[ -f references/house-review-lens.md ]
assert "references/house-review-lens.md knowledge base exists" "$?"

grep -q 'Calibration' references/house-review-lens.md && grep -qE 'HR-01|HR-10' references/house-review-lens.md
assert "house-review-lens.md has the HR ruleset + calibration" "$?"

for s in pb-copy pb-design-review pb-pop; do
  grep -q 'house-review-lens.md' "commands/$s.md"
  assert "$s loads the house review lens" "$?"
done

# --- Summary ---

echo
echo "smoke.sh: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo "Failures:"
  printf '  - %s\n' "${FAILED_NAMES[@]}"
  exit 1
fi
exit 0
