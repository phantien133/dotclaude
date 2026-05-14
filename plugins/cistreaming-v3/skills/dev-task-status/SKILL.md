---
description: Show the current dev-task workflow state without advancing it.
argument-hint: [task-title]
allowed-tools: Bash, Read
---

# dev-task-status

Show the current workflow state for a task without advancing it.

## Steps

1. If `$ARGUMENTS` provided: use as task title.
   Otherwise: list all folders in `streaming-docs/workflow/` and let developer pick, or auto-select if only one exists.

2. Read `streaming-docs/workflow/<task-title>/state.yaml`

3. Display in this format:

```
Task:    <task-slug>
Module:  <module>

Phase:   <current_phase> — <phase-name>
Status:  <status>

Gates:
  0  (Intake):        <confirmed|pending>
  1  (Plan):          <approved|pending|not_reached>
  2  (Impact):        <approved|pending|not_reached>
  3  (UI):            <approved|skipped|pending|not_reached>
  4  (TDD):           <approved|pending|not_reached>
  5  (Verify):        <approved|pending|not_reached>
  6  (PR):            <complete|not_reached>

Started:       <started_at>
Last updated:  <last_updated>
Notes:         <notes>
```

Phase name map: `"0"` → Intake, `"0b"` → Context Load, `"1"` → Plan, `"2"` → Impact, `"3"` → UI, `"4"` → TDD, `"5"` → Verify, `"6"` → PR

4. List workflow documents that exist in the task folder:
   `intake.md`, `context.md`, `questions.md`, `plan.md`, `impact.md`, `ui-inventory.md`, `tests.md`, `verify.md`, `pr.md`

5. Suggest next action: "Run `/dev-task` to advance to next phase."
