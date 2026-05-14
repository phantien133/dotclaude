---
description: Create a standardized checkpoint commit at RED or GREEN state during TDD, with a structured commit message and state.yaml update.
argument-hint: RED|GREEN <task-title>
allowed-tools: Bash, Read, Write, Edit
---

# streaming-checkpoint

Create a checkpoint commit for the current TDD state.

Arguments: `$ARGUMENTS` — format: `RED <task-title>` or `GREEN <task-title>`

## Steps

1. Parse arguments: state (`RED` or `GREEN`) + task title
2. Run `git status` to confirm there are staged or unstaged changes
3. Stage all changes related to the task:
   ```bash
   git add -p  # or git add <specific files from impact.md scope>
   ```
4. Create commit with structured message:
   - RED: `chore(workflow): [RED] <task-title> — tests failing, impl pending`
   - GREEN: `chore(workflow): [GREEN] <task-title> — tests passing, refactor done`
5. Update `streaming-docs/workflow/<task-title>/state.yaml`:
   - RED: add `checkpoint_red: <timestamp>` to notes
   - GREEN: add `checkpoint_green: <timestamp>` to notes

## Purpose

- Creates an auditable history without manual message crafting
- RED checkpoint: recovery point if implementation goes wrong
- GREEN checkpoint: clean baseline before code-reviewer runs
- Enables `git diff checkpoint_red..checkpoint_green` to see full TDD delta

## Output

Confirm: `Checkpoint [RED|GREEN] created: <commit-hash>`
