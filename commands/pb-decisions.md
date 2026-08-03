---
description: Surface the judgment calls around the current work. Retrospective by default — the choices the agent made and is not confident about. With --next, drill unresolved choices one at a time. With --now, name the consequential choices hidden in a proposal before any of it is built. Read-only, no edits.
allowed-tools: [Bash, Read, Grep, AskUserQuestion]
argument-hint: "(no arguments)  retrospective — unsure choices already made | [--next]  drill open choices one at a time | [--now]  instant gut-check on a proposal, no tools"
---

# pb-decisions

A diff shows what was decided. It never shows what was guessed. This command asks the agent to name its own low-confidence calls before they harden into "how the codebase works".

Read-only. It proposes nothing and edits nothing — the output is a list to react to.

## Modes

Three points on one timeline:

- **--now (before)** — the consequential choices hidden in something just proposed, answered instantly from the gut.
- **--next (during)** — choices still open, presented one at a time with a recommendation, until the user stops.
- **default (after)** — choices already made in this session or branch that the agent is genuinely unsure about.

**Dispatch: run exactly one mode, then stop.** Select it before reading any further section, and execute only that section — the other two do not apply to this invocation.

- `--now` in `$ARGUMENTS` → the `--now` section. Nothing else in this file runs, including the scope block.
- `--next` in `$ARGUMENTS` → the `--next` section, after the scope block.
- neither → the default section, after the scope block.
- both `--now` and `--next`, or any unrecognised flag → run nothing. Print `pb-decisions: pick one mode — --now, --next, or no argument` and stop. Guessing which was meant produces the wrong point on the timeline.

## --now mode — before anything is built

Answer **instantly**, from the gut, in the very next message. Read no files, run no commands, search nothing. The scope section below does not apply to this mode.

That constraint is the feature. The value of `--now` is that it lands while the proposal is still cheap to change — a version that first reads the codebase arrives after the user has moved on, and by then the shape is already being defended rather than chosen.

Name the **1-3 genuinely consequential choices** hidden in what the user just proposed. Fewer is better; one real choice beats three padded ones. For each: the options in a few words, then your gut recommendation.

```
1. <the choice> — <option A> vs <option B>. Gut: <A>, because <half a line>.
```

Consequential means the two paths lead to materially different work, or one of them is expensive to undo. The recurring three:

- One-off now, or something that gets called again later.
- A few lines inline, or its own module with a boundary.
- The biggest thing this could break that nobody is thinking about yet.

Skip anything reversible in minutes — say nothing rather than pad the list. Then stop and wait. Do not start building, do not write a plan, do not ask a follow-up. Being wrong quickly is fine here; the user corrects a gut call in one line, and that exchange is worth more than a researched answer that arrives too late to matter.

Being unsure of the domain is not a reason to skip the mode. Say which choice you would make and mark the guess as a guess.

## Scope

Applies to the default and `--next` modes only.

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
