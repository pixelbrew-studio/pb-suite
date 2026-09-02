# Workflow optimizations

Global, stack-agnostic rules for keeping the pb-suite loop fast without weakening its gates.

## General workflow

Use the lightest command that fits the phase:

| Phase | Use | Skip |
|---|---|---|
| Planning | `/pb-tdd --slice-only` or `/pb-implement --plan-only` | Full implementation and check |
| Each slice | `/pb-tdd <slice>` | `/pb-check`, `/pb-implement` |
| Mid-feature sanity | `/pb-review` | `/pb-check` until the diff is ready |
| Sensitive paths | `/pb-cso --diff` | Full `/pb-check` when no sensitive path changed |
| UI polish | `/pb-design-review` | Re-running the full check |
| Before a PR | `/pb-check` once on the frozen diff, or targeted reviews | Repeated full audits |
| Merge | `/pb-ship` once | Re-running the ship gate |

`/pb-check` is for the full picture once, not after every slice. It is an audit and does not replace the project's test, lint, typecheck, or build gates.

## Monorepo gates

During slices, scope lint, typecheck, and tests to the changed package and its dependents when the repository's tooling supports that scope. Run the full workspace gate before a PR or where CI/pre-push requires it. Skip a local build unless build configuration, package boundaries, bundling, or deployment behavior changed.

## Implementation defaults

Use `/pb-implement --no-parallel` by default. Prefer in-process slices unless slices own disjoint files and parallelism materially reduces elapsed time. Run the full gate at the end of the feature, not after every slice. Use the project's watch mode or one affected test file during RED-GREEN when available.

## Model allocation

For bulk implementation, mechanical edits, fixture/test setup, and routine checks, dispatch to the cheapest available model that can complete the bounded task. The user may pin `PB_BULK_WORK_MODEL`; otherwise choose from the current model catalog by cost and capability.

The strongest selected model must perform sanitization (redaction, anonymization, PII/ZDR shaping, and retention classification), evaluation (test-oracle interpretation, scoring, acceptance, and review triage), security/compliance decisions, and final integration/synthesis itself. Sub-agents may gather evidence or propose patches; they cannot make the final judgment or own final sanitization/evaluation.

If a bulk task crosses into a critical path, stop delegation and return it to the strongest model. Do not spend the strongest model on routine parallel work or repeated local checks when a cheaper capable model can do them.

## Shipping and runtime proof

Keep `/pb-ship` for merge-time work. It may be run with `--dry` for a pre-merge gate, but expensive end-to-end checks should run once there and otherwise be left to CI when CI covers them. Keep a local development server running when useful; pass its URL to `/pb-qa` or `/pb-check` only when runtime evidence is needed.

## Risk matching

Match verification breadth to the risk bucket:

| Bucket | Typical work | Minimum suite behavior |
|---|---|---|
| `skip` | Docs, copy, type-only changes | No broadened test suite |
| `light` | Standard CRUD, admin, or tooling work | Happy path plus one failure path |
| `strict` | Billing, auth, AI, retention, PII, or evaluation | Applicable edge cases, human gate, and independent review |

Using `strict` for a development-experience change adds gates without adding useful signal.

## Default feature loop

1. Plan the feature or slice.
2. Implement each slice with `/pb-tdd` and scoped gates.
3. Run only the specialist review required by the changed surface.
4. Use `/pb-review` for a mid-feature checkpoint.
5. Freeze the diff and run `/pb-check` once before the PR.
6. Open the PR and let CI or the pre-push hook run the full workspace gate.
7. Run `/pb-ship` once at merge time.

## Cross-model review

Choose the strongest currently available independent reviewer; do not hard-code a model family or named model. The user may pin `PB_CROSS_MODEL_REVIEW_MODEL` to the exact model ID. Run the selected reviewer once on a frozen diff before ship in read-only/plan mode, follow the command's neutral-prompt rule, and record the resolved model ID and harness. Triage findings as `BLOCKER`, `IMPORTANT`, or `NIT`; fix confirmed `BLOCKER`s in one batch. Do not re-run after every micro-fix. Re-run only after a material scope change or an unresolved correctness question. `IMPORTANT` and `NIT` findings do not block shipping unless the user promotes them.
