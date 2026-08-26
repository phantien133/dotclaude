---
description: Reset a w-task workflow back to phase 0, or wipe the task folder entirely. Reads state root from .claude/workflow.yaml.
argument-hint: <task-slug> [--wipe]
allowed-tools: Bash, Read, Write
---

# w-reset

Reset or wipe workflow state for `$ARGUMENTS`.

---

## Step 1 — Parse arguments

Split `$ARGUMENTS` into:
- `task-slug`: first token
- `--wipe` flag: present or absent

If no task slug provided: list folders in `<state_root>/` and ask developer to pick.

---

## Step 2 — Load config

```bash
cat .claude/workflow.yaml 2>/dev/null
```

Extract `workflow.state_root` → default `.workflow`.

---

## Step 3 — Confirm

Read current state:

```bash
cat <state_root>/<task-slug>/state.yaml 2>/dev/null
```

Show current phase and status, then ask:

**Default (no `--wipe`):**
```
Reset state.yaml to phase 0 for `<task-slug>`?
Documents (context.md, plan.md, etc.) will be preserved.
(y/n) [n]:
```

**`--wipe`:**
```
⚠️  Delete <state_root>/<task-slug>/ entirely?
All documents will be lost. This cannot be undone.
(y/n) [n]:
```

Default answer is `n` — do not proceed without explicit confirmation.

---

## Step 4 — Execute

**Default:**

Rewrite `state.yaml` — preserve `task`, `module` if present; reset everything else:

```yaml
task: <task-slug>
phase: "0"
status: gate_pending
intake_confirmed: false
gates: {}
started_at: <original started_at>
last_updated: <now>
notes: "Reset to phase 0"
```

**`--wipe`:**

```bash
rm -rf <state_root>/<task-slug>/
```

---

## Step 5 — Output

**Default:** "State reset to phase 0 for `<task-slug>`. Documents preserved. Run `/w-task` to restart from intake."

**`--wipe`:** "`<task-slug>` wiped. Run `/w-task <title>` to start a new task."
