---
description: Surface the judgment calls behind the current work. Retrospective by default — the choices the agent made and is not confident about. With --next, forward-looking — drill unresolved choices one at a time. Read-only, no edits.
allowed-tools: [Bash, Read, Grep, AskUserQuestion]
argument-hint: "(no arguments)  retrospective — unsure choices already made | [--next]  forward — drill open choices one at a time"
---

# pb-decisions

A diff shows what was decided. It never shows what was guessed. This command asks the agent to name its own low-confidence calls before they harden into "how the codebase works".

Read-only. It proposes nothing and edits nothing — the output is a list to react to.

## Modes

- **default (retrospective)** — choices already made in this session or branch that the agent is genuinely unsure about.
- **--next (forward)** — choices still open, presented one at a time with a recommendation, until the user stops.

## Scope

```bash
source "$HOME/.claude/commands/pb-bootstrap.sh"
source "$PB_SUITE/scripts/lib/scope.sh"
```

Use the shared diff scope. If the session already carries the work in context, that context wins — the diff is the fallback for a cold start, not the source of truth. A decision that never reached the diff (a rejected approach, a library not added) still counts.

## Default mode — decisions already made

Report only choices that are **genuinely uncertain**. A decision with an obviously correct answer is not a decision; listing it is noise and trains the user to skim the output.

For each, one line of what and one line of the alternative not taken:

```
1. <the choice, plain english>
   Alternative: <what else was plausible, and what would have to be true for it to win>
   Bucket: strict | light | skip
```

Ordering: strict-bucket items first, then by blast radius.

Qualifies as uncertain:

- A shape or contract picked without the user weighing in — table layout, API response shape, error semantics, retry behavior, cache key.
- A default value with no evidence behind it — timeout, page size, threshold, model choice, TTL.
- An assumption about data or callers that was never verified — "IDs are unique per org", "this only runs server-side", "the upstream always sends a timestamp".
- A boundary that could sit one layer up or down — validation in the route vs the lib, scoping in the query vs the handler.
- Something deliberately deferred that the code now silently depends on.

Does not qualify:

- Anything the user explicitly decided. Their call, not yours.
- Naming, formatting, file placement, import order.
- Established repo convention followed as-is.
- A choice with one correct answer under the constraints.

If nothing genuinely qualifies, say so in one line and stop. An empty list is a valid result; padding it is worse than returning nothing.

**Strict-bucket escalation.** Any uncertain decision touching the repo's strict bucket — AI request construction, billing or credits, auth and tenant scoping, retention or deletion, pseudonymization, evaluation and scoring — is not a note. Mark it and say which command settles it: `/pb-cso` for a security or scoping call, `/pb-tdd` for a contract that needs a test to pin it down, `/pb-investigate` when the uncertainty is about actual runtime behavior rather than design.

## --next mode — decisions still open

One at a time. Never a batch.

1. Present the single most consequential unresolved choice.
2. Give up to four options, a few words each.
3. State which one you would pick and why, in one sentence.
4. Ask via `AskUserQuestion`, then stop and wait.

After the user answers: record it where the work lives (the plan doc, the PR body draft, the spec) if one exists, then repeat with the next most consequential choice. Stop when the user says stop or nothing consequential is left.

Consequential means the two options lead to materially different work. Anything reversible in a few minutes is not consequential — pick the lazier one and move on without asking.

## Report

```
pb-decisions: N uncertain (S strict)
```

Then the list. Nothing else — no summary paragraph, no recommendation to run other commands beyond the per-item escalation above.

## What this command does NOT do

- Not a review — it does not look for defects. That is `/pb-review` on a diff, `/pb-audit` on stable code.
- Not a planner — it names open choices, it does not sequence work.
- Not an editor — it never applies a decision, even an obvious one.
