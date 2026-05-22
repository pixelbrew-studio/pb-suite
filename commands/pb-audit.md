---
description: Audit existing, stable code for defects, missing tests, and unsafe assumptions. Adversarial read-only pass. "It ships" is not evidence of correctness.
allowed-tools: [Bash, Read, Grep, Glob, AskUserQuestion]
argument-hint: "<scope> [--mode A|B|C] [--depth smoke|standard|deep] [--spec <paths|none>]"
---

# pb-audit

Adversarial audit of existing, stable code. No diff. The code may look fine and still be wrong — treat it as untrusted.

Severity here is `critical | high | medium | low` (not BLOCKER/IMPORTANT/NIT) — the output is a ranked backlog with effort estimates, not a merge gate. Read-only; never edits files.

## Inputs

Parse `$ARGUMENTS`; ask via `AskUserQuestion` for anything missing.

- **SCOPE** — explicit list of files or directories. No glob-bombs. Required.
- **MODE** — `A` audit only · `B` audit + characterization plan · `C` behavior-inventory backfill. Default `A`.
- **DEPTH** — `smoke` · `standard` · `deep`. Default `standard`.
- **SPEC SOURCES** — paths to spec docs, Notion exports, README sections, or `none — reconstruct from code`.
- **KNOWN CONCERNS** — what the user already suspects, or `none`.

If SCOPE is wrong (too broad, too narrow, missing a file the code clearly depends on), stop and say so. Do not silently expand scope.

## Phases

### 0. Read and map

Read every file in SCOPE. Produce:
1. One-paragraph summary of what this code does, in your own words.
2. Every public entry point — exported function, API route, CLI command, event handler, DB trigger.
3. Every external dependency — DB tables, env vars, third-party APIs, file system, other internal modules.
4. Every test file that appears to cover this code, with the framework noted.

### 1. Behavior inventory (reconstruct, don't assume)

12-25 numbered behaviors this code should have. Derive in priority order:

(a) SPEC SOURCES · (b) function/route/table names · (c) existing test names · (d) inferred from code structure.

Cite the evidence per behavior. Items derived only from (d): mark `[INFERRED]`. Items with no clear signal: mark `[SPECULATIVE — confirm with author]`.

### 2. Coverage map

For each behavior, mark exactly one:

- `[TESTED]` — specific test exists; cite file and test name.
- `[IMPLEMENTED]` — code handles it but no test pins it down; cite file:line.
- `[MISSING]` — neither code nor test addresses it.
- `[CONTRADICTED]` — code does the opposite of expected; likely bug, flag urgently.

No skipping items.

### 3. Testability review

For each entry point: are seams testable? Are external dependencies mockable or wrapped? Are tests deterministic (no real clock, network, randomness, file system)? Is the harness fast enough to actually run pre-merge? Flag hidden globals, singleton state, hard-coded paths, and env-var sniffing from inside business logic.

### 4. Safety review

Run the OWASP+STRIDE checklist from `pb-cso` (steps 6 and 7) against SCOPE — same confidence-gate, every critical-equivalent needs a concrete two-sentence exploit scenario.

Per applicable category, also answer: *if this attack were tried today against the deployed version, would existing logs show it?* If no, the missing observability is its own defect — log it in the register under `observability`.

GDPR pass when PII is in SCOPE: lawful basis recorded, retention boundary, data-subject-access path, leaks via logs or error messages, third-party sub-processor flow.

### 5. Defect register

Single ranked list of every defect, missing test, and unsafe assumption from phases 1-4. Per entry:

```
[critical|high|medium|low] [bug|missing test|testability|security|observability]
  Location:  file:line
  Issue:     <one sentence>
  Fix:       <one sentence — "characterization test first" is valid>
  Effort:    trivial (<30m) | small (<2h) | medium (<1d) | large (>1d)
```

Sort by severity, then by ascending effort within severity. This is the work backlog.

### 6. Characterization test plan (MODE B and C only)

For every `[IMPLEMENTED]` and `[CONTRADICTED]` entry from phase 2, write a plan for a test that captures what the code **currently** does. Comment each plan as `believed correct` or `suspect`. The point is to detect future drift, not to assert correctness.

For `[CONTRADICTED]` entries, write **two** plans — one capturing current (buggy) behavior, one capturing intended behavior. Tag the buggy one `delete-when-fixed`.

### 7. Runnable verification

List commands the user runs on their own machine. Include at minimum:

- The full existing test suite — must be green. If it isn't, that is finding #1.
- A coverage report scoped to SCOPE files.
- For Supabase audits: `supabase test db` plus a manual RLS spot-check via the dashboard policy tester.
- A grep-based secrets scan against SCOPE.

### 8. Verdict

Exactly one:

- **HEALTHY** — no critical or high defects; medium/low items go to backlog.
- **NEEDS WORK** — critical or high defects found; list the minimum set of fixes required before this code can be considered stable.
- **REWRITE** — defects so structural that patching them costs more than rewriting SCOPE from scratch against a fresh spec.

## Hard rules

- Read-only. Do not modify code during the audit.
- Do not add tests during phases 1-5 — planning only. Implementation happens after the human reviews the register.
- Do not propose refactors that aren't justified by a specific defect.
- If SPEC SOURCES contradict the code, the spec wins as the source of truth for what SHOULD be — flag the contradiction explicitly so the human can decide which side is wrong.
- If you can't determine something, write `UNKNOWN — need [X]`. UNKNOWN is a valid output. Hallucination is not.
