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

Extract `workflow.state_root` → default `.workflow`. Also note `repos[]` (version 2)
so the PR row can show one line per repo; if absent, treat as a single `.` repo.

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
Graph:   <ready | stale | not-indexed | unavailable | disabled>   (state.yaml codegraph)

Gates:
  0   Intake         <confirmed | pending | not_reached>
  0b  Context Load   <done | pending | not_reached>
  1   Plan           <approved | pending | not_reached>
  2   Impact         <approved | pending | not_reached>
  3   UI             <approved | skipped | pending | not_reached>
  4a  TDD Review     <approved | pending | not_reached>
  4c  Browser        <verified | not_applicable | unavailable | contended | skipped_by_operator | error | not_reached>
  4b  Commit         <done | pending | not_reached>
  5   Docs           <done | skipped | pending | not_reached>
  5b  Acceptance     <accepted | accepted_with_gaps | open_issues | skipped | iteration <N>/<max> | not_reached>
  6   PR             <complete | not_reached>

PRs (if status complete — from state.yaml prs[]):
  <repo> → <target>   <url>
  ...

Started:       <started_at>
Last updated:  <last_updated>
Notes:         <notes if any>
```

If `state.yaml` has a `prs:` list, render one line per entry. Omit the block when absent.

Phase name map:
`"0"` → Intake, `"0b"` → Context Load, `"1"` → Plan,
`"2"` → Impact, `"3"` → UI, `"4"` → TDD, `"5"` → Docs,
`"5b"` → Acceptance Verify, `"6"` → PR

When `gates.5b` is `open_issues`, add one line after the gate list:
`⚠️ <N> open issue(s) — see open-issues.md`

---

## Step 5 — List documents

```bash
ls <state_root>/<task-slug>/
```

Show which of these exist: `intake.md`, `context.md`, `questions.md`, `plan.md`,
`impact.md`, `ui-inventory.md`, `figma-spec.md`, `figma-parity-report.md`, `tests.md`,
`verify.md`, `acceptance.md`, `open-issues.md`, `pr.md`

---

## Step 6 — Suggest next action

Based on `phase` + `status`:
- `gate_pending` → "Run `/w-task` to advance to next phase."
- `complete` → "Task complete and **terminal** — all PR(s) created (see `prs:` above / `pr.md`). Nothing left to run."
- `blocked` + `gates.5b: open_issues` → "Acceptance verification exhausted its fix loop —
  read `open-issues.md`, then run `/w-task` and reply c (PR with known gaps), p (re-plan)
  or f (you fix it)."
- `blocked` (other) → "Task is blocked — see `state.yaml notes` field."
