---
description: Orchestrate a full feature dev workflow (intake → context → plan → impact → UI → TDD → docs → PR). Reads project config from .claude/workflow.yaml. Pass an issue URL, #N, or free task title to start.
argument-hint: <issue-url | #N | title>
allowed-tools: Bash, Read, Write, Edit, Skill
---

# w-task

Full feature development workflow. State-machine with explicit gates — advances only when
the developer runs `/w-task`.

**First run:** `$ARGUMENTS` is an issue reference or free title → starts Phase 0.  
**Subsequent runs:** `$ARGUMENTS` empty or `continue` → reads `state.yaml`, advances to next phase.

---

## ⚠️ Invocation gate — read on every run

The workflow advances **only** when the developer explicitly runs `/w-task`.

- During a gate pause: freely chat, ask questions, request edits — **do NOT advance the phase**.
- A phase transition happens **only** at the moment this skill is invoked with empty / `continue`.
- If `$ARGUMENTS` is anything other than empty / `continue` / issue ref / title: treat as a
  question or correction — respond and stay in the current phase.
- Never infer "the developer is done" from context. Wait for the explicit signal.

```
$ARGUMENTS present (URL / #N / title)?
  └─ Yes → First run: start Phase 0
  └─ No (empty or "continue") →
       state.yaml exists?
         └─ No  → Ask for issue reference or title
         └─ Yes → Read phase + status, advance
```

---

## Setup check

Before Phase 0, read config:

```bash
cat .claude/workflow.yaml 2>/dev/null
```

If file missing: say "Run `/w-setup` first to configure this project." Stop.

Extract and store for this session:
- `issue_tracker.*` — how to fetch ticket data
- `workflow.state_root` → default `.workflow`
- `workflow.docs_root` → null means skip Phase 5
- `project.test_command`, `.typecheck_command`, `.lint_command`
- `pr.default_branch`, `.draft`, `.template`

---

## Phase 0 — Intake (INTERACTIVE → GATE 0)

**Goal:** understand what we're building before touching any code.

### 0.1 Resolve issue

Parse `$ARGUMENTS` based on `issue_tracker.type`:

**github:**
- URL (`github.com/.*/issues/\d+`): extract N → `gh issue view <N> --json title,body --repo <org/repo>`
- `#N` or bare number: `gh issue view <N> --json title,body`
- Free text: use as-is.
- If `gh` fails: proceed with $ARGUMENTS as title.

**plane (mcp_available: true):**
- URL matching configured `url` or identifier (e.g. `PROJ-42`):
  call `mcp__plane__retrieve_work_item_by_identifier`
- Free text: use as-is.

**plane (mcp_available: false) / jira / linear:**
- URL or identifier: ask developer to paste the ticket description.
- Free text: use as-is.

**none:** always use $ARGUMENTS as-is.

### 0.2 Derive task-slug

- Issue with ID: `<ID>-<short-slug>` (kebab-case, max 25 chars for slug part)
- Free title: kebab-case, max 40 chars.

Create directory `<state_root>/<task-slug>/`.

### 0.3 Write intake.md

```markdown
# Intake — <title>

## Source
- Input: <URL / identifier / "free title">
- Issue ID: <ID or n/a>
- Fetched: <yes / no>

## Title
<title>

## Description
<description from issue, or "— not provided —">
```

### 0.4 Pause

Show summary card and ask developer to confirm or correct:
```
Please confirm (or correct) before we proceed:

1. Title: <title> — correct?
2. Any additional context, constraints, or related files?
3. If the description above is incomplete, paste the correct one now.

Reply in chat, then run /w-task when ready.
```

Write `state.yaml`:
```yaml
task: <task-slug>
phase: "0"
status: gate_pending
intake_confirmed: false
started_at: <timestamp>
last_updated: <timestamp>
```

**GATE 0:** developer replies in chat → runs `/w-task`.

---

## Phase 0b — Codebase Snapshot (AUTO, runs immediately after GATE 0)

*Triggers when `phase: "0"` + `status: gate_pending` and developer runs `/w-task`.*

Read developer's reply from GATE 0. Update `intake.md` with any corrections.

1. **File inventory** — understand the codebase shape:

   ```bash
   git ls-files | head -300
   ```

   Filter to source files (exclude lock files, dist, .git).

2. **Keyword grep** — find immediately relevant files:

   Extract 3-5 keywords from intake title + description (nouns, class names, function names).
   
   ```bash
   git grep -l "<keyword>" 2>/dev/null | head -20
   ```

   Run for each keyword, deduplicate results.

3. **Read relevant files** — read the top 3-5 most relevant files found above.
   If `project.src_dirs` is set in config: scope the search there.

4. **Write context.md**:

   ```markdown
   # Context — <title>

   ## Task Summary
   <intake title, issue ID, description>

   ## Relevant Files
   | File | Why relevant |
   |------|-------------|
   | `<path>` | <reason> |

   ## Patterns Observed
   <key patterns, naming conventions, existing similar features>

   ## Suggested Approach
   <based on codebase patterns — 1-2 sentences>
   ```

5. Update `state.yaml`:
   ```yaml
   phase: "1"
   status: gate_pending
   intake_confirmed: true
   last_updated: <timestamp>
   ```

Output: "Context loaded. Run `/w-task` to start planning."

---

## Phase 1 — Plan (INTERACTIVE → GATE 1)

*Triggers when `phase: "1"` + `status: gate_pending`.*

1. Read `intake.md` + `context.md`.

2. Write `questions.md`:
   ```markdown
   # Questions — <title>

   ## What I understood
   <summary — developer corrects misunderstandings here>

   ## Clarifying questions
   <edge cases, acceptance criteria, abnormal flows, integration points>

   ## Suggested scenarios that may be missing
   <AI-identified gaps>
   ```

3. **Pause** — say: "Fill answers in `questions.md`, then run `/w-task`."

4. Update `state.yaml`: `status: gate_pending`.

**GATE 1:** developer fills `questions.md` → runs `/w-task`.

*After developer runs `/w-task`:*

5. Read answered `questions.md`.

6. **Spawn `planner` agent** — pass as brief:
   - `intake.md` full content
   - `context.md` § Relevant Files + § Patterns Observed
   - Answered `questions.md`
   - Instruction: produce a plan with sections — Feature scope, Implementation approach per layer, Out of scope, Dependencies, Risks.

7. Write `plan.md` from agent output.

8. Update `state.yaml`: `gates.1: plan_written`, `status: gate_pending`.

Output: "Review plan.md. Run `/w-task` to approve and proceed."

**GATE 1b:** developer reviews `plan.md` → runs `/w-task`.

---

## Phase 2 — Impact & Design (AUTO → GATE 2)

*Triggers when `phase: "1"` + `status: gate_pending` + `gates.1: plan_written`.*

1. Read `context.md` + `plan.md`.

2. Write `impact.md`:

   ```markdown
   # Impact — <title>

   ## Affected Files
   | File | Change type | Notes |
   |------|-------------|-------|
   | `<path>` | add / modify / delete | <reason> |

   ## Dependencies
   <new packages, services, or modules required>

   ## Risks
   <potential breakage, edge cases, performance concerns>

   ## Sequence Diagram
   <Mermaid sequence diagram for the main happy path>
   ```

3. **Auto-generate additional diagrams** when task has:
   - >3 services interacting non-obviously → extra Mermaid sequence per sub-flow
   - State machine logic → Mermaid stateDiagram-v2
   - New data models → Mermaid erDiagram stub

4. Update `state.yaml`: `phase: "2"`, `status: gate_pending`.

Output:
```
impact.md is ready. Before approving:
• Challenge assumptions — does the sequence diagram match your mental model?
• Update the design — if something is wrong, say so in chat and I'll revise.

This is the last checkpoint before implementation shape is committed.
Run /w-task when satisfied.
```

**GATE 2:** developer discusses / approves → runs `/w-task`.

Update `state.yaml`: `phase: "3"`, `status: gate_pending`.

---

## Phase 3 — UI (CONDITIONAL → GATE 3)

*Triggers when `phase: "3"` + `status: gate_pending`.*

Check `plan.md` + `impact.md` for UI mentions.

**No UI changes:**

Update `state.yaml`: `gates.3: skipped`, `phase: "4"`, `status: gate_pending`.
Output: "No UI changes detected. Run `/w-task` to start TDD."

**GATE 3 (skipped):** developer runs `/w-task` → Phase 4.

**UI changes detected:**

Output:
```
UI changes detected in plan.md.

If you have a Figma design ready:
  /f-import <figma-url>                   → MCP import (recommended)
  /f-import --export <folder>             → import from Figma export folder
  /f-import --hybrid <figma-url> <folder> → MCP classification + export code

Run /f-setup first if Figma has not been configured for this project.
When done (or if skipping UI assets), run /w-task to proceed to TDD.
```

Update `state.yaml`: `status: gate_pending`.

**GATE 3:** developer runs UI skills manually or skips → runs `/w-task`.

Update `state.yaml`: `gates.3: ui_verified`, `phase: "4"`, `status: gate_pending`.

---

## Phase 4 — TDD (AUTO → GATE 4a → GATE 4b)

*Triggers when `phase: "4"` + `status: gate_pending`.*

1. **Spawn `tdd-guide` agent** — pass:
   - `impact.md § Affected Files`
   - `plan.md`
   - Instruction: suggest test structure, edge cases, and mocking strategies for the affected files.

2. Write test file skeletons based on `tdd-guide` advice + `impact.md` scope.
   Fill in failing test assertions (RED state).

3. **Resolve test command** from config (`project.test_command`, expand `auto`).
   
   Run tests → confirm RED:
   ```bash
   <test_command> 2>&1 | tail -30
   ```

4. Write `tests.md`:
   ```markdown
   # Tests — <title>

   ## Test files
   <list>

   ## Coverage plan
   <what each test covers, based on impact.md>

   ## State: RED ✗
   <failing output snippet>
   ```

5. Update `state.yaml`: `status: gate_pending`.

Output: "Review tests.md — confirm test structure covers impact.md scope. Run `/w-task` to approve."

**GATE 4 (mini):** developer confirms → runs `/w-task`.

6. **Run `w-checkpoint RED <task-slug>`** — checkpoint before implementation.

7. **Invoke `tdd-workflow` skill** — pass `plan.md` + `tests.md` as context for RED→GREEN→refactor.

8. Run tests → confirm GREEN.

9. **Run `w-checkpoint GREEN <task-slug>`** — checkpoint after GREEN.

10. **Inline checks** — in order, report each result:

    Resolve commands from config (expand `auto`):
    - Typecheck: `<typecheck_command>` on whole project
    - Lint: `<lint_command>` on affected files from `impact.md`
    - Tests with coverage (if test command supports it)

11. **Spawn `code-reviewer` agent** — scope: affected files from `impact.md` only:
    - Resolve CRITICAL/HIGH issues immediately, re-run tests to confirm still GREEN.
    - Document MEDIUM items in `tests.md § Code Review Notes`.

12. Write `verify.md`:
    ```markdown
    # Verify — <title>

    | Check | Result | Notes |
    |-------|--------|-------|
    | typecheck | ✅/❌ | |
    | lint | ✅/❌ | |
    | tests | ✅/❌ | |
    | code review | ✅/❌ | CRITICAL/HIGH resolved |
    ```

13. Update `tests.md`: add RED→GREEN record + reference `verify.md`.
14. Update `state.yaml`: `status: gate_pending`, `gates.4a: checks_green`.

Output: "Code is GREEN and checks pass. Review verify.md and diff. Run `/w-task` to commit."

**GATE 4a:** developer reviews verify.md + diff → runs `/w-task`.

15. **Commit the implementation**:
    ```bash
    git add <files from impact.md § Affected Files>
    git commit -m "feat(<scope>): <one-line summary from plan.md>"
    ```
    Do NOT use `git add -A` — stage only files listed in `impact.md`.

16. Update `state.yaml`: `phase: "5"`, `status: gate_pending`, `gates.4b: committed`.

Output: "Implementation committed. Run `/w-task` to proceed to doc persistence."

**GATE 4b:** developer runs `/w-task` → Phase 5.

---

## Phase 5 — Persist Docs (CONDITIONAL → GATE 5)

*Triggers when `phase: "5"` + `status: gate_pending`.*

Read `workflow.docs_root` from config.

**`docs_root: null`:** skip this phase entirely.
Update `state.yaml`: `gates.5: skipped`, `phase: "6"`, `status: gate_pending`.
Output: "Docs root not configured — skipping. Run `/w-task` to create the PR."

**`docs_root` set:**

Ask:
```
Is there a feature doc to update?
  Docs root: <docs_root>

Provide a file path within <docs_root> to append an implementation note,
or press Enter to skip.

Path (or Enter to skip): ___
```

If path provided: append dated implementation note:
```markdown

## <date> — <task-slug>

<one-paragraph summary of what was built and key decisions>
See: <state_root>/<task-slug>/plan.md
```

Update `state.yaml`: `gates.5: docs_written`, `status: gate_pending`.

Output: "Docs updated. Run `/w-task` to create the PR."

**GATE 5:** developer confirms → runs `/w-task`.

Update `state.yaml`: `phase: "6"`, `status: gate_pending`.

---

## Phase 6 — PR

*Triggers when `phase: "6"` + `status: gate_pending`.*

Output: "Run `/w-pr <task-slug>` to create the PR."

**GATE 6:** developer runs `/w-pr <task-slug>`.

Update `state.yaml`: `phase: "6"`, `status: complete`, `last_updated: <timestamp>`.

Output: "Task complete."

---

## State transitions summary

| phase | status | gates key | Next `/w-task` triggers |
|-------|--------|-----------|--------------------------|
| "0" | gate_pending | — | Phase 0b (context load) |
| "1" | gate_pending | — | Write questions.md → GATE 1 |
| "1" | gate_pending | plan_written | Phase 2 (impact) |
| "2" | gate_pending | — | Phase 3 (UI check) |
| "3" | gate_pending | skipped | Phase 4 (TDD) |
| "3" | gate_pending | ui_verified | Phase 4 (TDD) |
| "4" | gate_pending | — | GREEN + checks cycle |
| "4" | gate_pending | checks_green | Commit → Phase 5 |
| "5" | gate_pending | pending | Phase 5 doc persist or skip |
| "5" | gate_pending | docs_written | Phase 6 (PR) |
| "6" | gate_pending | — | Dev runs `/w-pr <task-slug>` → complete |

---

## Error recovery

If `state.yaml` shows `status: blocked`:
- Read `notes` field for blocker description.
- Surface to developer, wait for resolution before advancing.

If state.yaml is missing or corrupt: treat as first run, require `<issue-url-or-title>`.
