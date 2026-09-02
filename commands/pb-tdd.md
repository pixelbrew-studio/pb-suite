---
description: Test-first development discipline for coding-agent work. Forces tests as contract, not decoration. Greenfield (RED→GREEN→REFACTOR) or brownfield (CHARACTERIZE→RED→GREEN→REFACTOR), auto-detected. Risk-based — strict for money/privacy/auth/AI/retention/evaluation, lighter for UI/copy. Produces one small vertical slice per call. With no description, auto-detects context from working tree + branch + recent commits and proposes slices.
allowed-tools: [Bash, Read, Edit, Write, Glob, Grep, AskUserQuestion]
argument-hint: "[description] [--brownfield file:func] [--slice-only] [--no-risk] [--init-policy] [--auto]"
---

# pb-tdd

Test-first development for coding-agent work. The agent treats tests as the contract — written before implementation, must fail for the right reason, must stay green through refactor. Output is always one small vertical slice. Re-invoke for the next slice.

Workflow: `/pb-tdd <description>` → produces a working-tree change → `/pb-review` → `/pb-ship`.

Test-first applies where an automated test is a trustworthy oracle for the behavior — deterministic domain/decision logic, parsers and transformations, matching algorithms, state machines, authorization rules, reproducible bug fixes, public API contracts. Where the strongest evidence is something else (a runtime probe for a DB/route boundary, a browser check for UI, human judgment for copy or taste, a measurement for performance), that evidence belongs in the `/pb-implement` verification plan, not a brittle assertion forced to stand in for it. Reach for `/pb-implement` when the change spans more than one behavior or needs mixed evidence; `/pb-tdd` owns the single slice whose contract is a test.

## Risk buckets

Risk determines TDD strictness. Default buckets (override per project via a `## Testing policy` block in `CLAUDE.md`):

- **strict** — TDD required, full RED→GREEN→REFACTOR + edge cases. Applies to: AI request construction (incl. ZDR/PII shaping), billing/credits/idempotency, auth and org/tenant scoping, document upload/deletion lifecycle, pseudonymization, evidence anchoring, scoring/evaluation, analytics PII filtering, legal/subprocessor routes, secrets handling.
- **light** — one happy-path test plus one failure-path test. Skip the edge-case broadening. Applies to: standard CRUD on non-sensitive entities, internal admin tools, dev-experience tweaks.
- **skip** — no test required. Applies to: docs, comments, dependency bumps without runtime impact, pure visual copy/layout, type-only changes.

`--no-risk` forces light. Use only for pure UI/copy.

## Modes

- **greenfield** — no existing code to modify. RED → GREEN → REFACTOR.
- **brownfield** — change to existing code. CHARACTERIZE (lock current behavior with passing tests) → RED (new test for desired behavior) → GREEN → REFACTOR.

Auto-detection: if `--brownfield` is set, or if the description references a function/file/route that grep finds in the repo, the command runs in brownfield mode. Otherwise greenfield.

## Steps

### 0. `--init-policy` (early exit)

If `--init-policy` is in `$ARGUMENTS`: append the **Testing policy template** (bottom of this file) to the project's `CLAUDE.md` (or `AGENTS.md` if it exists and `CLAUDE.md` does not). Stop. Tell the user the file is now policy-anchored.

### 1. Triage

Parse `$ARGUMENTS`:
- Description (positional, optional — if missing or shorter than ~15 chars, run **Auto-context** below)
- `--brownfield <file:func>` — explicit pin
- `--slice-only` — planning-mode, no code written
- `--no-risk` — force light bucket
- `--auto` — force auto-context even when a description is given
- `--init-policy` — handled in step 0

Detect mode. For brownfield without explicit pin: grep the repo for the most specific noun in the description (function name, route path, component name). If exactly one match: brownfield with that target. If multiple or zero: greenfield.

Report mode + target.

### 1.5. Auto-context (triggered when description is missing, vague, or `--auto`)

Scan the local state for clues about what the user is working on. Then propose slices.

```bash
# Working tree
git status --short                                                                              # what files changed?
git diff HEAD --stat                                                                            # how much, where?
git diff HEAD 2>/dev/null | head -200                                                           # the actual change
git log --oneline -8                                                                            # recent intent
git branch --show-current                                                                       # branch name hint
git diff --name-only HEAD 2>/dev/null | xargs -I {} grep -l "TODO\|FIXME" {} 2>/dev/null | head # explicit todos
```

Extract signals:

- **Branch name** — `pix-33-upload-retention` strongly hints at upload + retention work.
- **Modified files** — group by directory. `src/lib/upload/*` modified suggests upload pipeline. New files in `src/app/api/` suggest a new route.
- **Diff hunks** — read 50-200 lines of the actual diff. Find new functions/methods/routes that have no corresponding test file. Find half-completed code (a function with a TODO mid-body, a route with empty handler, an `as any`).
- **Recent commits** — what theme has the user been on? Two of the last five commits about uploads = upload feature in flight.
- **TODO/FIXME** — anything explicit that flags what the user knows they still owe.

Propose 2-4 candidate slices. Each in Given/When/Then format, with risk-bucket pre-classified. Order by what looks most "in-flight" (largest diff, most TODOs, most recent commit message theme).

Use `AskUserQuestion` to present them. Options:

- **slice-N** — pick one of the proposed slices to implement now
- **describe-mine** — user provides their own description instead
- **slice-only** — show all slices, write nothing (planning mode)
- **cancel** — exit without action

Once a slice is chosen, continue with the rest of the steps using that as the description.

If auto-context finds nothing meaningful (clean working tree, no recent activity, generic branch name): tell the user there's no context to infer from, and ask them to provide a description.

### 2. Risk classify

Match the description against the bucket list above. If the project's `CLAUDE.md` defines its own bucketing, use that.

If contested or ambiguous, use `AskUserQuestion`:
- **strict** — TDD required, full broadening
- **light** — happy + failure path only
- **skip** — no test (rare; only use when truly trivial)

Report the chosen bucket and the reason (which keyword matched, or user's choice).

### 3. Slice

Decompose into the smallest vertical slice. A slice has:
- One concrete behavior
- One **Given / When / Then** trio
- One test layer choice (unit/Vitest, integration/Vitest+mocks, e2e/Playwright)

Bad slice: *"Implement upload feature."*
Good slice: *"Given a PDF upload, when the user submits it, then a file record is created with `recovery_expires_at = now + 14 days` and `extracted_text` is not persisted after analysis."*

If the feature is bigger than one slice: list all slices in order, implement only the first. The user re-invokes for the next.

If `--slice-only`: stop here. Output the slice list, nothing written.

### 4. Tests first

**Greenfield (RED)**:
- Pick the test layer (unit for pure logic, integration for module boundaries, e2e for critical user flows).
- Write only the test. No implementation, no scaffolding beyond what the test imports.
- Run the test runner. Confirm the test fails for the right reason — an assertion failure or a `function does not exist`, not a syntax error or missing import.

**Brownfield (CHARACTERIZE → RED)**:
- First: write 2-4 tests that pass against current behavior. These lock the contract before any change. Run them; confirm all green.
- Then: write the new test reflecting the desired (changed) behavior. Run it; confirm RED.
- Characterization tests stay green through the change unless you explicitly break one with `// breaking-by-design: <reason>` next to the changed assertion.

The point of characterization: prevent silent behavior drift. You may discover the current code does more than you thought — the characterization tests catch that.

### 5. Green — minimal implementation

Write the minimum code to make the RED test green. No extra features, no speculative interfaces, no helpers that aren't needed twice yet.

For brownfield: characterization tests must remain green (or be explicitly broken-by-design with a comment).

### 6. Refactor

Tidy up. Rename for clarity, extract a function only when used twice already, remove dead code. Do not change test expectations. If a test starts failing during refactor, you were changing behavior, not refactoring. Stop, revert, ask.

### 7. Broaden — edge cases (strict bucket only)

Add tests for the failure paths the strict bucket cares about. Pick the ones that apply to this slice — not all of them apply to every slice.

- Empty input, null, very large input, unicode
- Permission/auth boundary — does this enforce `user_id` / `organization_id` scoping?
- Idempotency — for billing, webhooks, retries
- PII handling — does sensitive data leak into logs or error messages?
- Retention contract — does the deletion timestamp land correctly?
- AI-request shaping — does the payload include the required compliance flags (e.g. `zdr: true`)?

One test per applicable path. Light bucket: one happy + one failure, skip the rest.

### 8. Gate

Apply [`references/workflow-optimizations.md`](../references/workflow-optimizations.md): in a monorepo, scope lint, typecheck, and tests to the changed package plus dependents during slices; reserve the full workspace gate for the pre-PR or CI/pre-push boundary; skip local builds unless build configuration, package boundaries, bundling, or deployment behavior changed.

Run the project's standard gate. Detect commands from `package.json` scripts (or the project's `CLAUDE.md`):

```bash
HAS_LINT=$(grep -q '"lint"' package.json 2>/dev/null && echo yes || echo no)
HAS_TYPECHECK=$(grep -qE '"typecheck"|"type-check"' package.json 2>/dev/null && echo yes || echo no)
HAS_BUILD=$(grep -q '"build"' package.json 2>/dev/null && echo yes || echo no)
HAS_TEST=$(grep -q '"test"' package.json 2>/dev/null && echo yes || echo no)
```

Run whatever exists for the affected package and its dependents, plus the new tests. Defer the full-workspace run to the pre-PR or CI/pre-push gate unless the repository has no safe scoped command. If anything is red: stop, fix, do not call the slice done. The point of TDD is that the gate is non-negotiable.

### 9. Report

```
pb-tdd: <slice description>
Mode:           greenfield | brownfield (target: <file:func>)
Risk:           strict | light | skip (<matched keyword or user choice>)
Test layer:     unit | integration | e2e
Slice:          Given <...> | When <...> | Then <...>
Tests added:    N (X characterization + Y new behavior + Z edge cases)
First red:      <test name> — failed because <reason>
Implementation: <files changed, with line counts>
Refactor:       <yes — what was tidied / no>
Gate:           lint=<pass/fail/skip> typecheck=<...> build=<...> tests=<...>
Remaining slices: <list if the feature is multi-slice, else "none">
```

End with: ready for `/pb-review`, or continue with `/pb-tdd <next slice>`?

## What this command does NOT do

- Not a full feature in one call — slices stay small, re-invoke for the next.
- Not a test-framework chooser — uses what the project has, fails loudly if there is no test runner.
- Not auto-commit — produces a working-tree change, `/pb-ship` handles the merge.
- Not a scaffold generator for fixtures/seeds — those are project-specific, live elsewhere (e.g. `e2e/helpers/` per the `e2e-from-pr` template).
- Not a coverage tool — coverage measures volume, not contract quality.

## Testing policy template (used by `--init-policy`)

When `--init-policy` is invoked, append this block to the project's `CLAUDE.md` (or `AGENTS.md`):

```md
## Testing policy

All new product behavior must be developed test-first unless the change is purely visual copy/layout.

Default stack:
- Vitest for unit and integration tests
- Playwright for critical user flows
- No new testing framework without an actual first test

Required for every feature PR:
- At least one failing test written before implementation
- Tests cover the main success path and one meaningful failure path
- AI, billing, auth, retention, analytics and evidence logic require tests
- UI-only changes require either Playwright smoke coverage or explicit manual verification

Risk buckets (override the defaults of `/pb-tdd` if listed here):
- strict — <list project-specific strict areas>
- light — <list project-specific light areas>
- skip — <list project-specific skip areas>
```
