# Workflow optimizations

Global, stack-agnostic rules for keeping the pb-suite loop fast without weakening its gates.

## Command ladder

1. Slice: `/pb-tdd`
2. Mid-feature checkpoint: `/pb-review`
3. Before opening a PR: `/pb-check` once, on the frozen diff
4. Merge: `/pb-ship` once

Use `/pb-review` for focused checkpoints during a feature. Reserve `/pb-check` for the complete pre-PR audit, and `/pb-ship` for the merge gate.

## Monorepo gates

During slices, scope lint, typecheck, and tests to the changed package and its dependents when the repository's tooling supports that scope. Run the full workspace gate before a PR or where CI/pre-push requires it. Skip a local build unless build configuration, package boundaries, bundling, or deployment behavior changed.

## Model allocation

For bulk implementation, mechanical edits, fixture/test setup, and routine checks, dispatch to the cheapest available model that can complete the bounded task. The user may pin `PB_BULK_WORK_MODEL`; otherwise choose from the current model catalog by cost and capability.

The strongest selected model must perform sanitization (redaction, anonymization, PII/ZDR shaping, and retention classification), evaluation (test-oracle interpretation, scoring, acceptance, and review triage), security/compliance decisions, and final integration/synthesis itself. Sub-agents may gather evidence or propose patches; they cannot make the final judgment or own final sanitization/evaluation.

If a bulk task crosses into a critical path, stop delegation and return it to the strongest model. Do not spend the strongest model on routine parallel work or repeated local checks when a cheaper capable model can do them.

## Cross-model review

Choose the strongest currently available independent reviewer; do not hard-code a model family or named model. The user may pin `PB_CROSS_MODEL_REVIEW_MODEL` to the exact model ID. Run the selected reviewer once on a frozen diff before ship in read-only/plan mode, follow the command's neutral-prompt rule, and record the resolved model ID and harness. Triage findings as `BLOCKER`, `IMPORTANT`, or `NIT`; fix confirmed `BLOCKER`s in one batch. Do not re-run after every micro-fix. Re-run only after a material scope change or an unresolved correctness question. `IMPORTANT` and `NIT` findings do not block shipping unless the user promotes them.
