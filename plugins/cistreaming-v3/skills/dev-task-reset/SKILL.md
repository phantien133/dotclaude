---
description: Reset the dev-task workflow state for a task back to phase 0, or wipe the task folder entirely.
argument-hint: <task-title> [--wipe]
allowed-tools: Bash, Read, Write
---

# dev-task-reset

Reset or wipe the workflow state for task `$ARGUMENTS`.

## Modes

**Default (no --wipe):** Reset `state.yaml` to phase 0, status running. Preserve all documents (context.md, plan.md, etc.) — they can be reused.

**--wipe:** Delete the entire `streaming-docs/workflow/<task-title>/` folder. Use only when starting completely fresh.

## Steps

1. Parse arguments: task-title + optional `--wipe` flag
2. Confirm with developer before any destructive action:
   - Default: "Reset state.yaml to phase 0 for `<task-title>`? Documents will be preserved."
   - --wipe: "Delete `streaming-docs/workflow/<task-title>/` entirely? This cannot be undone."
3. If confirmed:
   - Default: rewrite `state.yaml` — set `current_phase: 0`, reset all gates to `not_reached`, clear `last_updated`
   - --wipe: `rm -rf streaming-docs/workflow/<task-title>/`
4. If `workflow-links.md` exists for the module:
   - Default: update row status to `in-progress`
   - --wipe: update row status to `abandoned`, add Notes column with reason

## Output

Confirm reset/wipe with task title and mode used.
