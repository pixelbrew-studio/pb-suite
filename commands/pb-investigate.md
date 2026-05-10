---
description: Root-cause debugging with discipline. Reproduce first, hypothesize before touching code, three failed fixes triggers a step back. Iron law — no fixes without investigation.
allowed-tools: [Bash, Read, Edit, Grep, Glob]
argument-hint: "<symptom>  one-line description, error message, or file:line of the bug"
---

# pb-investigate

Root-cause debugging. Investigate before you fix. Symptoms lie — the bug you see is rarely the bug you have.

## Iron law

No fix without a confirmed root cause. Symptom-fixes create whack-a-mole — every patch that doesn't address the cause makes the next bug harder to find. If you can't articulate *why* the fix works, you have not found the cause yet.

## Steps

### 1. Capture the symptom

Read what the user gave (`$ARGUMENTS` if present). If it's vague, ask ONE question and stop until answered:

- Exact error message or unexpected behavior
- How to reproduce — minimal steps
- Where it shows up — log line, browser console, test failure, user report
- Frequency — every time, sometimes, only after X

If the user gives a stack trace, file:line, or PR/issue reference, jump straight to step 2.

### 2. Reproduce

You cannot debug what you cannot reproduce. Try in this order:

1. The exact steps the user gave
2. Run the failing test: `<test command for the project>`
3. Hit the route, run the script, click the button
4. Inspect logs around the failure window

If you cannot reproduce after a focused attempt: stop and report. Tell the user what you tried and what's missing. Do not guess-fix a bug you can't see.

### 3. Read the path

Trace from symptom backwards:

```bash
# What changed recently in the affected files?
git log --oneline -20 -- <affected-files>
git blame <affected-file> | grep -A2 -B2 <relevant-line>
```

- If this used to work, the cause is in the diff since it last worked. Bisect mentally first, with `git bisect` only if the diff is large.
- Read the actual code path, not just the file. Use Grep to find every caller of the failing function, every reader of the failing field.
- Check whether nearby code makes assumptions that this change breaks.

### 4. Form a hypothesis

State it explicitly, in one sentence:

> "Root cause hypothesis: `<what>` is wrong because `<why>`. Confidence: N/10."

A hypothesis is testable. "It might be a race condition" is not — "the second `save()` runs before the first one's `await` resolves because we removed the `await` on line X" is.

If confidence is below 6/10, gather more evidence before proceeding. Add a log line, read more callers, run the test with verbose output. Do not start editing.

### 5. Test the hypothesis without fixing

Confirm the root cause directly before changing behavior:

- Add a log/print that proves the hypothesis (then remove it)
- Run the path with a debugger or a minimal repro
- Inspect actual values where you assumed certain values

If the test does not confirm the hypothesis: hypothesis was wrong. Go back to step 3 with what you learned. Update the hypothesis. Do not stack a new fix on top of a wrong one.

### 6. Three-fix rule

If three attempted fixes have not resolved the symptom, stop. Three failures means the model of the system is wrong, not the fix. Step back:

- Re-read the symptom — are you fixing the right thing?
- Is the bug in a layer above or below where you've been looking?
- Is there a structural issue (the code is fragile here for a reason — bad abstraction, missing invariant)?
- Surface the architectural question to the user before attempting fix #4.

### 7. Fix

Only when root cause is confirmed. Make the smallest change that addresses it. Do not bundle cleanup, refactors, or "while I'm here" edits — they hide the actual fix in noise.

If the fix needs a new test (it usually does), write it first. The test should fail without your fix and pass with it.

### 8. Verify

- Run the failing test or reproduction. It now passes.
- Run the broader test suite. Nothing else broke.
- Re-read the diff. Is the change minimal? Is the *why* clear from the code or commit message?

If anything is yellow, do not call it done.

### 9. Report

```
Symptom: <one line>
Reproduced: <yes/no, how>
Root cause: <one sentence>
Confidence the cause is correct: N/10
Fix: <file:line bullets>
Tests: <new test added | existing test now passes>
Open questions: <anything you're not sure about, or skip if none>
```

If this investigation revealed a recurring pattern in the same area, name it. Recurring bugs are architectural smells, not bad luck — surface for the user to decide whether a structural fix is in scope. If a CIL decision exists that this bug invalidates, mention which one.
