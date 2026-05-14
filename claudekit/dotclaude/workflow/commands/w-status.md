---
description: Show the current w-task workflow state for one or all tasks without advancing it.
argument-hint: [task-slug]
allowed-tools: Bash, Read
---

# w-status

Display workflow state without advancing any phase.

---

## Step 1 — Load config

```bash
cat .claude/workflow.yaml 2>/dev/null
```

Extract `workflow.state_root` → default `.workflow`.

---

## Step 2 — Resolve task

**`$ARGUMENTS` provided:** use as task slug → read `<state_root>/<task-slug>/state.yaml`.

**`$ARGUMENTS` empty:**

```bash
ls <state_root>/ 2>/dev/null
```

- No folders: say "No active tasks. Run `/w-task <title>` to start one." Stop.
- One folder: auto-select it.
- Multiple folders: list them and ask developer to pick:
  ```
  Active tasks:
    1) FEAT-42-email-verification
    2) FIX-17-login-timeout

  Enter number or task slug:
  ```

---

## Step 3 — Read state

```bash
cat <state_root>/<task-slug>/state.yaml
```

If file missing: say "No state.yaml found for `<task-slug>`. The task may not have started yet."

---

## Step 4 — Display

```
Task:    <task>
Phase:   <phase> — <phase-name>
Status:  <status>

Gates:
  0   Intake         <confirmed | pending | not_reached>
  0b  Context Load   <done | pending | not_reached>
  1   Plan           <approved | pending | not_reached>
  2   Impact         <approved | pending | not_reached>
  3   UI             <approved | skipped | pending | not_reached>
  4a  TDD Review     <approved | pending | not_reached>
  4b  Commit         <done | pending | not_reached>
  5   Docs           <done | skipped | pending | not_reached>
  6   PR             <complete | not_reached>

Started:       <started_at>
Last updated:  <last_updated>
Notes:         <notes if any>
```

Phase name map:
`"0"` → Intake, `"0b"` → Context Load, `"1"` → Plan,
`"2"` → Impact, `"3"` → UI, `"4"` → TDD, `"5"` → Docs, `"6"` → PR

---

## Step 5 — List documents

```bash
ls <state_root>/<task-slug>/
```

Show which of these exist: `intake.md`, `context.md`, `questions.md`, `plan.md`,
`impact.md`, `ui-inventory.md`, `tests.md`, `verify.md`, `pr.md`

---

## Step 6 — Suggest next action

Based on `phase` + `status`:
- `gate_pending` → "Run `/w-task` to advance to next phase."
- `complete` → "Task complete. PR was created — see `pr.md`."
- `blocked` → "Task is blocked — see `state.yaml notes` field."
