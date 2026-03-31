---
name: verification-before-completion
description: Use before claiming any task is complete, before committing, before pushing, before any success statement
---

# Verification Before Completion

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

Skipping verification is not efficiency — it is dishonesty.

## The Verification Gate

Before ANY success claim, you must:

1. **Identify** the command that proves your assertion
2. **Execute** it fully and freshly — no cached results
3. **Read** complete output including exit codes
4. **Verify** whether the output actually supports your claim
5. **Only then** make the claim with evidence

## Applies To

Every variation of success claims, including:
- "Done", "Complete", "Fixed", "Working", "Ready"
- Committing code
- Pushing to remote
- Closing a task
- Transitioning to the next step

## Red Flags — STOP and Run Verification

- Using "should", "probably", "seems to", "looks like"
- Expressing satisfaction before running the verification command
- Committing or pushing without running tests/linter
- Trusting a subagent's "success" report without independent confirmation
- Saying "it worked" based on the absence of error output alone

## Common False Equivalencies

| This does NOT mean → | This |
|----------------------|------|
| "Linter passed" | Compilation succeeds |
| "Agent said success" | Task is actually complete |
| "No errors shown" | Output is correct |
| "Test ran" | Test passed |
| "Partial checks passed" | Everything passes |

## What Counts as Verification Evidence

- Exit code 0 from the relevant command
- Actual output matching expected output
- Test suite output showing pass count
- File contents matching what was intended
- HTTP response confirming a change

## Scope

This is non-negotiable. There are no exceptions for:
- Simple changes ("it's just a typo fix")
- Time pressure ("quickly just push it")
- Previous success ("worked last time")
- Trust ("I just wrote it myself")

---
*Cherry-picked from obra/superpowers — https://github.com/obra/superpowers*
