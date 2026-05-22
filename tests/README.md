# tests/

Bash smoke tests for pb-suite. Run: `./tests/smoke.sh`.

This is not a unit-test framework. pb-suite has no runtime code to unit-test — the skills are LLM-interpreted markdown. The tests cover:

- **Install / uninstall mechanics** — `./install` creates the `pb-bootstrap.sh` symlink; `./uninstall` removes it; `source pb-bootstrap.sh` resolves `PB_SUITE`; `PB_SUITE_HOME` override works.
- **Content invariants on skill files** — converted skills source the bootstrap helper, refuse-flag patterns are present where required, canonical headings exist, guard-rail language is intact.
- **Embedded-bash refuse conditions** — where a skill's preflight bash contains a refuse-check (e.g. "this is pb-suite itself"), the test simulates the matching condition and verifies the check would trigger.

What is intentionally **not** covered:

- **Interactive `AskUserQuestion` flows** in `/pb-init`, `/pb-rules`, `/pb-pr`, `/pb-evolve` — these require a real Claude session to drive. Listed as manual checks in the PR's test plan.
- **The Claude-interpreted parts of skills** — what the LLM does with the markdown is by design out of scope for a deterministic test.
- **Downstream integration** — running pb-suite skills against actual project repos is a separate, end-to-end validation that lives in the consumer projects.

Exit code 0 means all assertions passed. Non-zero means at least one failed; the failure list prints at the end.
