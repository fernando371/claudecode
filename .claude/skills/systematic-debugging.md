---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
---

# Systematic Debugging

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## When to Use

Use for ANY technical issue: test failures, bugs, unexpected behavior, performance problems, build failures.

**Use this ESPECIALLY when:**
- Under time pressure (emergencies make guessing tempting)
- "Just one quick fix" seems obvious
- You've already tried multiple fixes

## The Four Phases

You MUST complete each phase before proceeding to the next.

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully** — don't skip past errors; read stack traces completely
2. **Reproduce Consistently** — if not reproducible, gather more data, don't guess
3. **Check Recent Changes** — git diff, recent commits, new dependencies, config changes
4. **Gather Evidence in Multi-Component Systems**

   For each component boundary:
   - Log what data enters the component
   - Log what data exits the component
   - Verify environment/config propagation
   - Check state at each layer

   Run once to gather evidence showing WHERE it breaks, THEN analyze, THEN investigate.

5. **Trace Data Flow** — where does bad value originate? Trace up until you find the source. Fix at source, not at symptom.

### Phase 2: Pattern Analysis

1. Find working examples of similar code in the same codebase
2. Read reference implementations COMPLETELY — don't skim
3. List every difference between working and broken, however small
4. Understand all dependencies and assumptions

### Phase 3: Hypothesis and Testing

1. State clearly: "I think X is the root cause because Y" — write it down
2. Make the SMALLEST possible change to test one variable
3. Did it work? Yes → Phase 4. No → form NEW hypothesis, don't stack more fixes
4. If you don't understand something, say so — don't pretend

### Phase 4: Implementation

1. Create a failing test case (automated if possible) — MUST have before fixing
2. Implement ONE change addressing the root cause — no "while I'm here" improvements
3. Verify: test passes, no other tests broken, issue resolved
4. **If fix doesn't work:** count how many fixes tried
   - < 3: return to Phase 1 with new information
   - **≥ 3: STOP — question the architecture, discuss with human before attempting more fixes**

## Red Flags — STOP and Return to Phase 1

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "Add multiple changes, run tests"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "One more fix attempt" (when already tried 2+)
- Each fix reveals a new problem in a different place

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need process" | Simple issues have root causes too |
| "Emergency, no time for process" | Systematic is FASTER than guess-and-check |
| "Just try this first, then investigate" | First fix sets the pattern — do it right |
| "Multiple fixes at once saves time" | Can't isolate what worked; causes new bugs |
| "One more fix attempt" (after 2+) | 3+ failures = architectural problem |

## Quick Reference

| Phase | Key Activities | Success Criteria |
|-------|---------------|------------------|
| **1. Root Cause** | Read errors, reproduce, check changes, gather evidence | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare | Identify differences |
| **3. Hypothesis** | Form theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify | Bug resolved, tests pass |

---
*Cherry-picked from obra/superpowers — https://github.com/obra/superpowers*
