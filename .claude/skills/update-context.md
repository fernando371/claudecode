---
name: update-context
description: Use at the end of any session that produced decisions, conventions, or relevant findings to persist them in .claude/project-context.md
---

# Update Project Context

## When to Use

Run this at the end of a session whenever:
- A new architectural decision was made
- A convention was established or changed
- A "don't do X" rule was discovered
- A new tool, hook, or skill was added to the setup
- A non-obvious fix was found that should be remembered

Do NOT update for: routine tasks, one-off commands, or anything already documented.

## Process

1. **Review what happened** — scan the conversation for decisions, not just actions
2. **Open `.claude/project-context.md`**
3. **Update the relevant section** — choose the right section, don't append blindly:
   - New tool/hook/skill → "Decisões arquiteturais"
   - New rule → "O que não fazer"
   - New convention → "Convenções"
4. **Add a dated entry** to "Histórico de decisões relevantes":
   ```
   YYYY-MM-DD: descrição concisa da decisão
   ```
5. **Keep it short** — one line per decision. No narratives.

## Rules

- Never duplicate what is already there — read before writing
- Never record what is obvious from the file structure itself
- Never record temporary or session-specific context
- If unsure whether something is worth recording, it probably isn't
