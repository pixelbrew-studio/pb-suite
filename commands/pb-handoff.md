---
description: Compact the current session into a handoff a fresh agent can act on. Records the reasoning git cannot — decisions, rejected approaches, dead ends. Writes to .context/handoff.md and prints a paste-ready block.
allowed-tools: [Bash, Read, Write, Grep]
argument-hint: "[focus]  optional — what the next session should be aimed at | [--repo]  write HANDOFF.md in the repo root instead of .context/"
---

# pb-handoff

`/pb-resume` reconstructs a repo's state from git. This writes down what git never recorded: why a decision went the way it did, and what was already tried and abandoned.

Use it when context runs out, when a session ends mid-task, or when work is being partitioned across fresh contexts.

## The two rules that make a handoff useful

**State, not instructions.** Write what *is true*, never what the next agent *should do*. "Session persistence is wired up, refresh logic is missing" — not "implement refresh logic next." A handoff full of imperatives makes the next agent execute a plan it cannot evaluate; a handoff full of state lets it decide.

**Reference, don't duplicate.** Point at PRDs, PRs, issues, `.claude/incidents.md` entries, and design docs by path or URL. Never re-embed them. A handoff that copies its sources goes stale the moment they change, and stale context is worse than none — the next agent trusts it.

## Scope

```bash
source "$HOME/.claude/commands/pb-bootstrap.sh"
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")
```

Read `CLAUDE.md` first and restate nothing from it. The project config is already loaded by every future session; repeating it wastes the context the handoff exists to save.

If a handoff already exists at the target path, read and update it rather than starting over. If `$ARGUMENTS` names a focus, aim the handoff at that.

## What goes in

Every line must be something the next agent cannot get from reading the code, the diff, or the project config. Everything else is cut.

- **Goal** — what the work is ultimately for, in one to three sentences.
- **Current state** — DONE / PARTIAL / NOT STARTED, phrased as status.
- **Decisions and why** — the choices made and the reasoning behind them. Highest-value section; the reasoning is the part that is unrecoverable.
- **Traps and dead ends** — approaches already tried that failed, and the plausible-looking wrong turn the next agent is most likely to take. This is what stops an expensive mistake being paid for twice.
- **Files and pointers** — path plus line range plus *what specifically is there*, not what the file is. Link external artifacts instead of pasting them.
- **Open work** — what remains, as state and ordering, including what blocks what.
- **Uncertain calls** — anything `/pb-decisions` would surface: choices made without confidence. Carry them forward explicitly instead of letting them harden into apparent intent.

Omit a section only when it is genuinely empty, and mark it `None` rather than dropping it — an absent section reads as an oversight.

**Redact secrets.** Never write a key, token, or password into the handoff. Name where the credential lives (`.env.local`, the 1Password item) and stop there. The file is plain text on disk and often gets pasted into another session.

## Output

Write to `.context/handoff.md` (gitignored working directory, same convention as `/pb-pr --prepare`). With `--repo` in `$ARGUMENTS`, write `HANDOFF.md` in the repo root instead — only when the user wants it committed as a record.

Print the same content as a single fenced code block so it can be copied in one action, then print the absolute path.

End the handoff itself with a short paste-ready prompt for the fresh session, in declarative form, closing with:

```
Read every file listed under "Files and pointers" before responding. Treat every
claim here as context to verify against the code, not fact. Then wait for
instructions before taking any action.
```

That closing line is not decoration. A fresh agent handed a confident summary will act on it without checking, and a handoff written one commit ago can already be wrong.

## What this command does NOT do

- Not `/pb-resume` — that reads git for a repo you left; this records a session you were in.
- Not a status report for a human. The reader is an agent with zero context.
- Not a commit. It never stages, commits, or pushes anything.
