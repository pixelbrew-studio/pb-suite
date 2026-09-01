---
description: Spec-first feature implementation, the orchestration layer above the suite. Plans verification before writing code (routing /pb-cso, /pb-design-review, /pb-copy by what the change touches), interviews for missing context, gates high-risk work behind explicit human approval, drives every slice through the /pb-tdd RED→GREEN→REFACTOR loop — in-process by default, sub-agents only when independence, parallelism, or a fresh evaluator earns it (escalating stuck slices to /pb-investigate), reviews with /pb-check breadth plus an independent cross-model frontier pass (Codex when Claude drives, Claude when Codex drives), feeds recurring patterns to /pb-evolve via the learning files, and proposes capturing repeatable work as a skill. Augmentation over blind automation.
allowed-tools: [Bash, Read, Edit, Write, Glob, Grep, Task, AskUserQuestion]
argument-hint: "[what to build]  [--spec <file>] [--interview] [--plan-only] [--no-parallel]"
---

# pb-implement

Build new behavior from a spec, not from assumptions. The front of the loop is a written spec and a verification plan; the back is a check that the plan actually passed. In between, every slice that needs code is driven through the `/pb-tdd` RED→GREEN→REFACTOR loop by its own sub-agent. This command owns the layer above the loop: spec, risk gating, slicing, parallel dispatch, and skill capture — `/pb-tdd` owns each slice.

Workflow: `/pb-implement <what>` → spec + verification plan → (human gate if strict) → `/pb-tdd` loop per slice (in-process by default, sub-agents when they earn it) → verify against plan → `/pb-check` (suite review breadth) + independent cross-model frontier review (depth) → learning artifacts → `/pb-pr`/`/pb-ship`.

It reuses the suite rather than duplicating it: per-slice discipline is `/pb-tdd`, the review fan-out is `/pb-check` (which routes to `/pb-cso`, `/pb-design-review`, `/pb-copy`, `/pb-qa` by what changed), stuck slices escalate to `/pb-investigate`, and recurring patterns feed `/pb-evolve` through the learning files.

## Iron law

No code before two artifacts exist: a **spec** (so assumptions are explicit and reviewable) and a **verification plan** (so "done" is defined before building, not rationalized after). If you can't say how you'll prove the feature works, you're not ready to write it.

## Steps

### 1. Spec — or interview me

Parse `$ARGUMENTS`. Establish the spec from, in order: `--spec <file>` if given, then the description, then the repo (branch name, recent commits, open TODOs, linked Linear/issue).

A usable spec names: the behavior, the inputs and their shapes, the success output, the failure/edge paths, and the boundaries (auth/tenant scope, data retention, money). If any of these are missing, vague, or contradictory — **Interview me**: ask the smallest set of questions that removes the ambiguity, batched in one `AskUserQuestion` (do not drip questions one at a time). Stop until answered. Thin context is the single biggest source of rework — pay it down here, not in review.

Write the resolved spec to `.context/spec-<slug>.md` (Conductor's shared dir) so it survives the session and other agents can read it. `--interview` forces the questions even when the description looks complete.

### 2. Risk classify

Match the spec against the suite risk buckets (override per project via `CLAUDE.md`):

- **strict** — AI request construction (incl. ZDR/PII shaping), billing/credits/idempotency, auth and org/tenant scoping, document upload/deletion/retention, pseudonymization, evidence anchoring, scoring/evaluation, analytics PII, legal/subprocessor routes, secrets handling.
- **light** — standard CRUD on non-sensitive entities, internal admin tools, dev-experience tweaks.
- **skip** — docs, comments, dep bumps without runtime impact, pure visual copy/layout, type-only changes.

The bucket sets both the test depth (handed to `/pb-tdd`) and whether step 4's human gate fires.

### 3. Verification plan — declared first

Before building, write down how each behavior in the spec will be proven, and with which tool. Be concrete — name the test files, routes, and checks, not "I'll test it":

- **Automated, quantifiable** → tests via `/pb-tdd` (Vitest unit/integration, Playwright e2e). Default for anything with a deterministic right answer.
- **Runtime / visual** → `/pb-qa <url>` for console/network/broken-image evidence, `/pb-browse <url>` for content, screenshots for layout.
- **External state** → the relevant MCP tool (DB row via Supabase, event via PostHog, payment object via Stripe) to confirm the side effect actually landed.
- **Specialist review, routed by what the change touches** → don't hand-pick a generic pass; read the project's `CLAUDE.md` trigger table and the areas the slices will touch, and add the matching review as a **mandatory** plan line: `src/lib/{ai,billing,auth}/` → `/pb-cso --diff`; `.tsx`/`.css`/tailwind → `/pb-design-review`; `marketing`/`landing`/user-facing copy → `/pb-copy --mode rewrite`; new env var or flag → `/pb-env-check`. Step 8 executes these (via `/pb-check`) plus a cross-model frontier review (step 8b). A billing slice without `/pb-cso --diff` in the plan is an incomplete plan.

**Taste test (augmentation vs automation).** For each behavior, decide: is the correct result quantifiable, or does it need human judgment (taste)? Apply the 80/20 rule — automate the check only when an 80%-correct result is acceptable for that behavior. Copy, visual polish, and tone are taste calls: plan a human look, not a brittle assertion that encodes one person's preference. Forcing taste into automation is how you accrue AI-slop and operational debt. Mark each behavior `auto` or `human-review` in the plan.

`--plan-only`: output the spec + verification plan and stop. Nothing written to source.

### 4. Human Validation Zone (strict bucket only)

For strict-bucket work, surface the spec + verification plan and get explicit approval **before writing code** via `AskUserQuestion`:

- **approve** — proceed to implement as specced.
- **revise** — user amends the spec/plan; loop back to step 1 or 3.
- **cancel** — stop, write nothing.

This gate is non-negotiable for money, auth/tenant boundaries, retention/deletion, and secrets. Do not auto-proceed on these even when the change looks small — the blast radius, not the diff size, sets the risk. Light/skip buckets skip this gate.

### 5. Decompose and parallelize

Break the spec into the smallest vertical slices — one concrete behavior each. Because the orchestrator holds the whole spec, it pre-assigns each slice so the slice agents never re-derive scope: a Given/When/Then, the risk bucket (from step 2), the test layer (unit/integration/e2e), the exact files the slice owns, and which other slices must land first.

Partition for dispatch into **waves**:

- **Independent** slices — no ordering constraint, disjoint file sets — run in one wave, dispatched in parallel (a single message with one `Task` per slice). The same shape also serves multiple perspectives on one hard slice (two competing implementations to compare) or bulk mechanical work.
- **Dependent** slices — later waves, in dependency order. A wave starts only after the slices it depends on have returned green.

`--no-parallel` collapses everything to one sequential wave (use when slices touch overlapping files). Never run two agents that write the same file concurrently — partition by file before dispatching; reads may overlap freely, writes may not.

### 6. Implement the slices

Every slice that needs code runs the `/pb-tdd` loop — the test-first contract holds regardless of who executes it. What is **not** mandatory is a separate sub-agent per slice. Decompose sub-agents only when it buys something concrete:

- Slices are genuinely independent (disjoint files) and parallelism materially cuts elapsed time.
- A fresh evaluator or a specialist perspective is needed (that is the point of the review passes in step 8, and of competing implementations on one hard slice).
- The work is bulk-mechanical and fans out cleanly.

Absent one of those, implement the coherent unit of work in-process, slice by slice, running the pb-tdd loop for each. A modern model carries a feature across implementation, tests, and integration more reliably than several isolated agents that lose local context and mis-wire interfaces at the seams — decomposition is a cost, not a default. A feature spanning several files is not by itself a reason to fan out.

When you do dispatch a slice to a `Task` agent, hand it: the slice's Given/When/Then, its risk bucket and test layer, the spec path (`.context/spec-<slug>.md`), and the files it owns. Whether in-process or dispatched, follow the pb-tdd loop exactly:

1. **Detect mode** — greenfield (new code) or brownfield (changing existing code → CHARACTERIZE current behavior with passing tests first).
2. **RED** — write the failing test for the new behavior; confirm it fails for the right reason (assertion / missing symbol, not a syntax or import error).
3. **GREEN** — the minimum code to pass. No speculative interfaces.
4. **REFACTOR** — tidy without changing expectations; characterization tests stay green.
5. **Broaden** — strict-bucket edge cases (auth/tenant scope, idempotency, PII, retention, AI-request shaping) where they apply to the slice.
6. **Gate** — run the slice's tests plus whatever `package.json` exposes; report pass/fail.

Each agent returns a structured result: slice id, mode, files changed (+line counts), the first RED test and why it failed, and the gate outcome. The orchestrator collects these per wave. A slice that comes back red, or that skipped RED (green on first write with no failing test recorded), is **not done** — re-dispatch it or surface it; never paper over it to keep the wave moving.

**Stuck slice → `/pb-investigate`.** Don't let an agent guess-patch. If a slice fails its gate twice, the agent isn't debugging — it's thrashing. Hand that slice to `/pb-investigate` (reproduce → hypothesis → confirmed root cause, with its own three-fix rule) instead of re-dispatching a third blind attempt. This matters most on strict slices: a billing or auth failure deserves a root cause, not a patch that turns the symptom green.

The spec is the contract every agent shares. If an agent reports the spec was wrong or under-specified, stop the wave, amend the spec (step 1), and for strict work re-confirm the gate before re-dispatching — never let one agent silently diverge from what the others were told to build.

### 7. Verify against the plan

Run the verification plan from step 3 — actually execute it, don't assert from memory. Every `auto` behavior must have a green check; every `human-review` behavior gets surfaced for the user to eyeball with the evidence attached (screenshot, QA output, MCP row). Run the project's full gate (lint / typecheck / build / test — whatever `package.json` exposes) as a regression smoke. Anything red or unrun means not done.

### 8. Review — suite breadth, then cross-model depth

Two passes, deliberately diverse. Don't re-implement what the suite already does; run it, then add the perspective it can't give itself.

**8a. Suite breadth — `/pb-check`.** Run `/pb-check` over the diff. It fans out the same-model reviewers the verification plan routed to — `/pb-review` always, plus `/pb-design-review` (UI), `/pb-cso --diff` (security-sensitive paths), `/pb-qa` (if a URL was given) — aggregates them under one severity model, and appends recurring patterns to `.claude/lessons.md`. This is the breadth pass: many lenses, one model.

**8b. Cross-model depth.** Tests and same-model review both inherit the author's blind spots. So hand the diff to a reviewer from a **different model family than the one driving this session**, always at the **frontier tier** of that family — never a mid-tier model:

- Claude-driven session → Codex review via the `codex` review agent, on its frontier model (the CLI default when that is the top tier; pin `-m` only to *upgrade*, never to downgrade)
- Codex-driven session → Claude review via `claude -p` on the frontier model (`claude --model claude-fable-5`; fall back to the top Opus only if Fable is unavailable)

**OpenCode fallback.** If the preferred Claude/Codex reviewer or its frontier model is unavailable, try OpenCode before declaring the cross-model pass unavailable. Require `PB_OPENCODE_REVIEW_MODEL` to contain an explicit `provider/model` id for a current frontier-tier **GLM or Grok** model that differs from the authoring model family. Confirm that exact id is available in `opencode models` (refresh the catalog if needed), then dispatch the same review prompt non-interactively through OpenCode's built-in read-only `plan` agent:

```bash
opencode run --agent plan --model "$PB_OPENCODE_REVIEW_MODEL" --dir "$(git rev-parse --show-toplevel)" "<review prompt>"
```

Do not use OpenCode's default agent or model, and do not guess an unpinned id. If local configuration overrides `plan` to permit edits, OpenCode is unavailable, the variable is unset, the model cannot be resolved, the model is not frontier-tier, or it belongs to the authoring family, the cross-model pass **does not satisfy the gate** and remains a BLOCKER for strict work. OpenCode is the review harness; model-family independence still comes from the resolved GLM or Grok model. Record the exact resolved `provider/model` id, not merely "OpenCode".

Dispatch the review of the branch diff (vs the merge base) with the spec (`.context/spec-<slug>.md`) and risk bucket as context. Independence from the agents that wrote *and* reviewed the slices is the point. Record the **resolved model id** in the report — a cross-model run on a mid-tier model does not satisfy the gate.

**Dispatch it in the background.** A frontier-tier review of a real diff routinely runs past ten minutes, and a foreground call dies on the tool timeout with nothing to show — the usual recovery is to shrink the prompt until it fits, which quietly trades review depth for a passing call. Send it to a background task, write the output to a file, and carry on with the rest of step 8 while it runs. Read the result before the report; an unread cross-model pass is not a completed one.

**Do not hand the reviewer a checklist.** Give it the diff, what the change is trying to do, and the risk bucket — then ask it to find what is wrong. Naming the failure modes to look for (`check for fail-open paths, regex gaps, and race conditions`) reliably produces findings in exactly those categories and silence everywhere else, which reads as a clean review and is not one. The reason the gate requires a different model family is that a different family has different priors and notices different things; an enumerated prompt overwrites that with yours, and the pass degrades into a slower search for the blind spots you already had. Say *where* to look when it is not obvious from the diff ("this is the safety layer", "this path handles other tenants' rows") — never *what* to find. The signal that the prompt was neutral is a finding you did not anticipate.

Triage every finding from both passes through the suite severity model — do not paste raw output:

- **BLOCKER** — confirm it's real (reproduce or trace it), then fix test-first by re-entering the slice's `/pb-tdd` loop. If the cause isn't obvious or the first fix doesn't hold, route it to `/pb-investigate` rather than patching the symptom. A live BLOCKER means the feature is not done.
- **IMPORTANT** — surface with your assessment; ask before acting (taste / completeness call).
- **NIT** — mention once; fix only if asked.

A reviewer (suite or cross-model) is not an oracle: discard findings that are wrong or out of scope, but say *why* — don't silently drop one you can't refute. If both the preferred reviewer and the OpenCode fallback are unavailable, say so in the report and note the cross-model pass did not run; `/pb-check` still ran, so review did not collapse to nothing.

### 9. Report

```
pb-implement: <feature>
Spec:           .context/spec-<slug>.md  (source: description | --spec | interview | repo)
Risk:           strict | light | skip  (<matched keyword or user choice>)
Human gate:     approved | n/a (<bucket>)
Verification:   <behavior → tool → auto/human-review>, one line each
Slices:         N slices — <in-process | K dispatched to agents in W waves, P parallel / S sequential>
Per slice:      <slice id → mode → first-red test → gate>, one line each
Implementation: <files changed, line counts>
Verify result:  auto=<all green?>  human-review=<surfaced items>
Review:         pb-check=<blockers/important/nits + which sub-reviews ran>  crossmodel=<resolved model id: findings, or "unavailable">
Gate:           lint=<...> typecheck=<...> build=<...> tests=<...>
Open questions: <unresolved spec ambiguities, or none>
```

End with the natural handoff: the spec + verification plan + review findings are exactly what a PR needs — offer `/pb-pr --prepare` (the verification plan maps onto the `## Test plan`), then `/pb-ship`.

### 10. Learning artifacts (opt-in)

Close the loop so the suite improves from real signal, not vibes — only when the project already opted in (the file existing is the signal; never create one unsolicited):

- If `.claude/lessons.md` exists, ensure the cross-pass pattern landed there (`/pb-check` writes it; add it yourself if you ran reviews directly). One line: the recurring shape, not this feature's specifics.
- If `.claude/incidents.md` exists and a slice failure or a confirmed BLOCKER was a real bug (not just a missing test), append the one-line root cause — the format `/pb-investigate` uses.

These feed `/pb-evolve`, which clusters at n≥3 and proposes surgical edits to the pb-* skills. A Gotcha you hit today becomes a checklist line in the relevant skill once it has recurred enough to be a pattern.

### 11. Propose skill capture

If this implementation followed a shape you'll repeat (same setup, same checks, same gotchas across features), offer to capture it — a project skill, or a suite addition via the pb-suite repo. A captured skill must carry a **Gotchas** section: the edge cases hit and mistakes made *this* run, written down so the next run doesn't repeat them. Seed it from the learning artifacts above. Propose only; never auto-create. Repeatable + quantifiable is the bar — one-off or taste-heavy work stays a conversation, not a skill.

## Gotchas

- **Interview drift.** Asking one question, getting an answer, asking the next — this burns turns and loses the user. Batch every open question into one `AskUserQuestion`. If you find yourself asking a second round, the first round was under-scoped.
- **Plan-after-build.** Writing the verification plan after the code is rationalization — you'll plan exactly the checks the code happens to pass. The plan is step 3 for a reason; it must precede a single line of implementation.
- **Silent spec divergence.** Implementation often reveals the spec was incomplete. The failure mode is patching around it quietly. Amend the spec file and, for strict work, re-confirm the gate — don't let the code become the only record of what was built.
- **Parallel write collisions.** Two sub-agents editing the same file race and clobber. Partition by file before dispatching; `--no-parallel` when partitions overlap. Reads can overlap freely; writes cannot.
- **Agent skips RED.** A slice agent that writes code first and a passing test after has not done TDD — it has written a test that can never have caught the bug. Require each agent to report the first failing test and *why* it failed; a slice with no recorded RED is re-dispatched, not accepted.
- **Contract skipped, not the agent.** Implementing in-process is fine and often better — dropping the pb-tdd loop is not. The failure mode is "quick" slices that skip RED or skip the risk-bucket gate because no sub-agent was there to enforce them. In-process means the orchestrator runs the loop itself, per slice, with the RED recorded; it does not mean writing code first and a passing test after.
- **Fanning out by reflex.** Spawning one agent per file because a feature touches several is decomposition for its own sake. Isolated agents lose the shared context that keeps interfaces consistent and re-wire the seams wrong. Fan out only for genuine independence, parallel time savings, a fresh evaluator, or a specialist perspective (step 6) — otherwise carry the unit of work coherently.
- **Cross-model review prompted with a checklist.** Listing the failure modes to look for returns findings in those categories and silence outside them — a clean-looking review that only searched where you pointed. The different model family is there for its different priors; an enumerated prompt replaces them with yours. Give it the diff and the intent, and let it decide what matters.
- **Cross-model review rubber-stamped or pasted raw.** The review is verification, not decoration. Dumping the other model's output verbatim, or accepting "looks good" without reading it, defeats the cross-model check. Triage every finding through the severity model, fix real BLOCKERs test-first, and state why anything dismissed was dismissed — a finding you can't refute is a finding you act on.
- **Skipping the routed specialist review.** A billing diff that gets only `/pb-review` and the cross-model pass, but no `/pb-cso --diff`, was under-reviewed — the security lens the suite already has for that path never ran. The verification plan routes by what the change touches (step 3); `/pb-check` then runs those reviews. Don't quietly drop one because the slice "looked fine."
- **Re-deriving instead of routing.** Hand-rolling a security check, a debugging loop, or a learning note inside this command duplicates `/pb-cso`, `/pb-investigate`, `/pb-evolve` — and drifts from them the moment one changes. Call the skill; if it's missing something, improve that skill.
- **Automating taste.** Encoding "the button should feel right" as a pixel assertion produces a brittle test that fails on every legitimate change and passes things that look wrong. If the right answer needs a human eye, mark it `human-review` and show evidence — don't fake a green check.
- **Strict gate skipped because "it's a small change".** Risk is blast radius, not diff size. A two-line change to a billing or auth path is still strict. The gate fires on the bucket, never on line count.

## What this command does NOT do

- Not a replacement for `/pb-tdd` — it orchestrates above it, running the `/pb-tdd` loop per slice (in-process or dispatched); the RED→GREEN→REFACTOR loop itself stays `/pb-tdd`'s job.
- Not a full feature in one silent run — strict work pauses at the human gate; the spec stays visible and amendable.
- Not auto-commit or auto-merge — produces a working-tree change; `/pb-pr` drafts, `/pb-ship` lands.
- Not a re-implementation of the suite — it routes to `/pb-check`, `/pb-cso`, `/pb-investigate`, `/pb-evolve` rather than re-deriving review, security, debugging, or learning logic. If a review dimension is missing, fix the underlying skill, not this one.
- Not a skill generator — step 11 proposes; the user (and the pb-suite repo conventions) decide whether it becomes one.
