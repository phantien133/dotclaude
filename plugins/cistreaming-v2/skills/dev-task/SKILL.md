---
description: Orchestrate the hilab streaming dev workflow (intake → context → plan → impact → UI → TDD → verify → PR). Pass a Plane ticket URL or a free task title to start.
argument-hint: <ticket-url-or-title>
allowed-tools: Bash, Read, Write, Edit, Skill, mcp__plane__retrieve_work_item_by_identifier, mcp__plane__retrieve_work_item, mcp__plane__search_work_items
---

# dev-task

Orchestrate the dev workflow for the Hilab streaming platform.

**First run:** `$ARGUMENTS` is a Plane ticket URL **or** a free task title → starts Phase 0.
**Subsequent runs:** `$ARGUMENTS` is empty or `continue` → reads `state.yaml` and advances to the next phase.

State: `streaming-docs/workflow/<task-slug>/state.yaml`
Docs:  `streaming-docs/workflow/<task-slug>/`

---

## ⚠️ Invocation gate — read this first on every run

**The workflow advances ONLY when the developer explicitly runs `/dev-task`.**

- During a gate pause, the developer may freely chat, ask questions, request edits, or add information — **do NOT advance the phase** in response to those messages. Answer or make the requested change, then wait.
- A phase transition happens **only** at the moment this skill is invoked (i.e., `$ARGUMENTS` is empty or `continue` and `state.yaml` exists with `status: gate_pending`).
- If `$ARGUMENTS` contains anything other than empty / `continue` / a URL / a task title, treat it as a question or correction within the current phase — respond and stay put.
- Never infer "the developer is done" from context. Wait for the explicit `/dev-task` signal.

**Decision tree on each invocation:**

```
$ARGUMENTS present and looks like a URL or task title?
  └─ Yes → First run: start Phase 0
  └─ No (empty or "continue") →
       state.yaml exists?
         └─ No  → Ask for ticket URL or task title (no state to resume)
         └─ Yes → Read phase + status, advance to next phase
```

---

## Phase 0 — Intake (INTERACTIVE → GATE 0)

**Goal:** understand what we're building before touching any code or docs.

1. Determine input type from `$ARGUMENTS`:
   - **Plane URL** (`pm.hilab.cloud/.../browse/<IDENTIFIER>/`): extract the identifier (e.g. `CISTREAMIN-11`) and call the Plane MCP tool `mcp__plane__retrieve_work_item_by_identifier` to fetch title, description, and labels.
     - If MCP call fails or tool unavailable: ask the developer to paste the ticket description.
   - **Free title** (anything else): treat as the task title; description is unknown.

2. Derive `task-slug`:
   - **Plane ticket:** `<IDENTIFIER>-<short-title>` — use the ticket identifier as prefix, then a concise kebab-case title (strip filler words like "add", "for", "the", "api"; keep the meaningful nouns/verbs; max 25 chars for the title part).
     Examples: `CISTREAMIN-11` + "Add API for sign-up" → `CISTREAMIN-11-sign-up-api`; "Implement chat message persistence" → `CISTREAMIN-21-chat-persistence`
   - **Free title:** kebab-case of the title, max 40 chars, no prefix.
   
   Create directory `streaming-docs/workflow/<task-slug>/`.

3. Write `intake.md`:
   ```
   # Intake — <title>
   ## Source
   - Input: <URL or "free title">
   - Ticket ID: <ID or n/a>
   - Fetched: <yes/no>

   ## Title
   <title>

   ## Description
   <description from ticket, or "— not provided —">

   ## Module Guess
   <best guess from title/description keywords, or "— unknown —">

   ## Story File
   — not provided —
   ```

4. **PAUSE** — display a summary card:
   - Show what was understood: title, ticket description (truncated to 5 lines), module guess
   - Ask the developer to confirm or correct **in this chat**:
     ```
     Please confirm (or correct) before we proceed:

     1. Module: <module-guess> — correct?
     2. Any additional context, constraints, or story file to add?
        (paste a story file path, extra requirements, or type "none")
     3. If the description above is missing or wrong, paste the correct one now.

     Reply here in chat, then run /dev-task when you're ready to load context.
     ```
   - Remind: these answers will drive the entire workflow — take a moment to be complete.

5. Write initial `state.yaml`:
   ```yaml
   task: <task-slug>
   phase: "0"
   status: gate_pending
   intake_confirmed: false
   ```

**GATE 0:** developer replies in chat with corrections/context, **then runs `/dev-task`** to trigger Phase 0b.
- On next `/dev-task` invocation: read the developer's chat replies above to populate `intake.md`, then proceed to Phase 0b.

---

## Phase 0b — Context Load (AUTO, runs immediately after GATE 0)

*Runs when `state.yaml` shows `phase: "0"` + `status: gate_pending` and developer runs `continue`.*

1. Read the developer's reply from the previous gate. Update `intake.md`:
   - § Module: confirmed module name
   - § Developer Notes: any extra context or constraints provided
   - § Story File: path if provided

2. Determine the doc folder: scan `streaming-docs/documents/modules/` for the folder matching `<NN>-<module>`.

3. **Read the module README** (`streaming-docs/documents/modules/<NN>-<module>/README.md`) first.
   - Parse the "Implementation Status" section — it lists ✅ Complete and ⏳ Deferred items for both API and Web layers.
   - Note: treat module as draft context if status is "not started".

   **Read previous feature records** — scan `streaming-docs/documents/modules/<NN>-<module>/features/` for existing `<feature-name>.md` files (one per feature, e.g. `sign-up.md`, `oauth-google.md`). For each file, read the "§ Constraints for future features" section. Cross-reference against the current task description to surface potential conflicts or decisions that the current task must respect. Include a § Previous Feature Decisions section in `context.md` listing any relevant constraints found.

4. **Read existing implementation guided by the README.** The code module name is the README folder name **without the NN prefix** (e.g. `03-stream` → `stream`).

   Use the README "Implementation Status ✅ Complete" list to decide what to read:
   - **API module dir:** `streaming-api/src/modules/<module>/`
     - `ls` the dir first to see actual files, then read the key services/resolvers/guards listed as ✅ in README.
   - **Shared/cross-cutting dirs** — read only if the module uses them (README or task description mentions it):
     - Queue processors: `streaming-api/src/queue/processors/` (BullMQ jobs)
     - Worker processes: `streaming-api/src/transcode-worker/` or `src/worker/`
     - Shared guards/decorators: `streaming-api/src/common/`
     - Redis service: `streaming-api/src/redis/`
   - **Web feature dir:** `streaming-web/src/features/<module>/`
     - `ls` to see actual files; read queries, mutations, hooks listed as ✅ in README.
   - **Web pages:** search `streaming-web/src/app/` for routes related to this module
     (pages are separate from features — `src/app/(app)/` for authenticated routes)
   - **Do NOT read ⏳ Deferred items** — they don't exist yet.

5. **Reuse check:**
   - Scan `streaming-api/src/common/` for reusable guards, decorators, exceptions
   - Grep for task-relevant keywords in `streaming-api/src/` (e.g. `ThrottlerModule`, `RateLimit`, module name)
   - Check `package.json` (api + web) for relevant installed libs

6. **Invoke `streaming-oq-check <module>`** → collect OQs relevant to this task.
   - If any returned OQ would **BLOCK** this task: flag it prominently and display:
     > ⚠️ OQ-XXX: <title> — this task may be blocked. Consider updating `streaming-docs/documents/overview/open-questions.md` with your decision before proceeding.
   - If OQs are relevant but not blocking: list them in context.md § Known Constraints and note:
     > 💡 These OQs touch this task — consider documenting any decisions you make in `open-questions.md`.

7. Write `context.md`:
   - § Task Summary: intake title, ticket ID, module, developer notes
   - § Tech Snapshot: module current state, key files read, patterns observed (based on README + code)
   - § Available Utilities: reusable guards/decorators/libs found in step 5
   - § Known Constraints: OQs from step 6 + any flags from README
   - § Previous Feature Decisions: constraints surfaced from `features/*.md` in step 3 (omit section if none)

8. Create/update `streaming-docs/documents/modules/<NN>-<module>/workflow-links.md`:
   - Create from template if absent
   - Append row: `| <task-slug> | [workflow/<task-slug>/](../../workflow/<task-slug>/) | <date> | in-progress |`

9. Update `state.yaml`:
   ```yaml
   phase: "1"
   status: gate_pending
   intake_confirmed: true
   module: <module>
   ```

Output: `context.md` written. Say: "Context loaded. Run `/dev-task` to start planning."

---

## Phase 1 — Plan (INTERACTIVE → GATE 1)

1. Read `intake.md` + `context.md` deeply.

2. Write `questions.md` — focus on gaps that `intake.md` didn't answer:
   - § What I understood (developer corrects misunderstandings)
   - § Clarifying questions — edge cases, acceptance criteria, abnormal flows, integration points
     *(skip basic scope questions — those were settled in Phase 0)*
   - § Suggested scenarios AI thinks are missing
   - § Known constraints from OQs (already in context.md — surface blockers explicitly)
   - § OQ decisions needed: for any OQ that this task will partially resolve, add a reminder:
     > 📝 If you decide on OQ-XXX during this task, update `streaming-docs/documents/overview/open-questions.md` with your decision — do not leave it implicit in the code.

3. **PAUSE** — say: "Fill answers in `questions.md`, then run `/dev-task`."
4. Update `state.yaml`: `status: gate_pending`

**After developer runs `continue`:**

5. Read answered `questions.md`.
6. **Spawn `planner` agent** to generate `plan.md`. Pass as brief:
   - `intake.md` full content (task title, description, module)
   - `context.md` Tech Snapshot + Available Utilities sections
   - Answered `questions.md`
   - Instruction: produce a streaming-stack plan with sections — Feature scope, Implementation approach per layer (NestJS → GraphQL → Prisma → Next.js), Out of scope, Dependencies, Risks.
7. Append § Phase 1 Plan Summary to the feature record (written in Phase 5 — skip here, plan.md is the source of truth during the workflow)
8. Append § Phase 1 Decisions to `context.md`
9. Update `state.yaml`: `status: gate_pending`, `gates."1": plan_written`

Output: `plan.md` written. Say: "Review plan.md. Run `/dev-task` to approve and proceed."

**GATE 1:** developer reviews `plan.md` and runs `/dev-task`.

---

## Phase 2 — Impact & Design (AUTO → GATE 2)

1. Read `context.md` + `plan.md`
2. Generate `impact.md` with all sections:
   - Affected Modules, Database Changes, GraphQL Schema Changes
   - BullMQ, Redis, Web (Next.js), Mobile Impact, Cross-cutting
   - Mermaid sequence diagram for main happy path

3. **Assess diagram needs** based on task complexity:

   - **Always include** in `impact.md`: Mermaid sequence diagram for the main happy path (already in step 2).

   - **Auto-generate** (no confirmation needed) when the task has any of:
     - >3 services interacting in a non-obvious order → additional Mermaid sequence diagram per sub-flow
     - New DB models or schema changes → PlantUML sub-ERD stub (`diagrams/<NN>-<module>-erd.puml`) written directly
     - State machine logic (e.g. stream session lifecycle, wallet event states) → Mermaid stateDiagram-v2

   - **Ask the developer** when the task is moderate complexity (borderline call):
     ```
     This task involves [X]. I can generate:
       A) Mermaid flow diagram — <what it would show>
       B) PlantUML sub-ERD — <affected models>
       C) Both
       D) Skip diagrams

     Reply A/B/C/D in chat, then run /dev-task to proceed.
     ```

   Write any generated diagrams into `impact.md` inline (Mermaid) or as `.puml` files in `streaming-docs/documents/database/diagrams/` (PlantUML ERD). Developer runs `make diagrams` separately if PNG output is needed.

4. If any new architecture decision: invoke `streaming-adr <title>` at end
5. Update `state.yaml`: `status: gate_pending`

Output: `impact.md` written. Say:

```
impact.md is ready. Before approving, take a moment to:

• Ask questions — anything unclear about scope, DB changes, or cross-module effects?
• Challenge assumptions — does the sequence diagram match your mental model?
• Update the design — if something is wrong or missing, say so now and I'll revise impact.md.

This is the last checkpoint before we commit to the implementation shape.
Run /dev-task when you're satisfied with the design.
```

**GATE 2:** developer discusses / requests revisions or approves and runs `/dev-task`.

5. Append § Phase 2 Impact Summary to `context.md`
6. Update `state.yaml`: `phase: "3"`, `status: running`

---

## Phase 3 — UI (CONDITIONAL → GATE 3)

Check: does `plan.md` or `impact.md` mention UI changes?

**If NO:** set `gates.3: skipped`, `phase: "4"`, `status: gate_pending` in `state.yaml`.
Output: Say "No UI changes detected. Run `/dev-task` to start TDD."
**GATE 3 (skipped):** developer runs `/dev-task` to proceed to Phase 4.

**If YES:**
1. Invoke `streaming-figma <module>` — show decision tree, ask for Figma path
2. **PAUSE** — wait for developer to provide Figma URL/path or `skip`
3. After path provided:
   - Invoke `/build-ui-kit <module>:<path>`
   - Invoke `/build-static-page <module>:<path>` for each page
4. Write `ui-inventory.md`
5. Update `state.yaml`: `status: gate_pending`, `gates."3": ui_verified`

Output: Say "Open /app/<module>/playground to verify. Run `/dev-task` when satisfied."

**GATE 3:** developer verifies playground, runs `/dev-task`.

---

## Phase 4 — TDD (AUTO → mini-GATE 4)

1. Invoke `streaming-test-stubs <task-slug>` — generate test file skeletons from `impact.md`
2. **Spawn `tdd-guide` agent** to advise on test structure. Pass as brief:
   - The generated test stubs
   - The `impact.md` affected files list
   - Instruction: review the test structure and suggest any missing edge cases, patterns, or streaming-specific mocking strategies before writing assertions.
3. Fill in failing test assertions based on `tdd-guide` advice
4. Run tests → confirm RED: `cd streaming-api && npx jest --testPathPattern=<module>`
5. Write `tests.md` at RED state: file list, describe outlines, coverage plan
6. Update `state.yaml`: `status: gate_pending`

Output: Say "Review tests.md — confirm test structure covers impact.md scope. Run `/dev-task` to approve."

**GATE 4 (mini):** developer confirms, runs continue.

7. **Invoke `tdd-workflow` skill** — pass `plan.md` + `tests.md` as context for RED→GREEN→refactor cycle
8. Run tests → confirm GREEN
9. Run inline checks — in order, report each result:
   - `git fetch && git status` — branch not behind master
   - Typecheck: `cd streaming-api && npx tsc --noEmit` (and `streaming-web` if web files changed)
   - Lint: `cd streaming-api && npx eslint src/modules/<module>/` (and web equivalent if needed)
   - Test coverage: `npx jest --testPathPattern=<module> --coverage`
   - Security: `npx audit-ci --moderate` (skip if no new deps)
10. **Spawn `code-reviewer` agent** (scope: impact.md's affected files only):
    - Resolve CRITICAL/HIGH issues immediately; re-run tests to confirm still GREEN
    - Document MEDIUM items in `tests.md § Code Review Notes`
11. Write `verify.md` with results table: branch sync, typecheck, lint, test coverage, security scan, code review notes
12. Update `tests.md`: RED→GREEN record + reference verify.md for full check results
13. Append § Phase 4 Test Summary to `context.md`
14. Update `state.yaml`: `status: gate_pending`, `gates."4b": checks_green`

Output: Say "Code is GREEN and all checks pass. Review verify.md and the diff before committing. Run `/dev-task` to commit and proceed to document persistence."

**GATE 4b:** developer reviews code + verify.md, runs continue.

15. **Commit the implementation** — conventional commit, English, scoped to task:
    ```
    git add <files from impact.md>
    git commit -m "feat(<module>): <one-line summary from plan.md>"
    ```
    Do NOT use `git add -A` — stage only files listed in `impact.md § Affected Files`.
16. Update `state.yaml`: `phase: "5"`, `status: gate_pending`, `gates."5": pending_persist`

Output: Say "Implementation committed. Run `/dev-task` to persist design artifacts to module docs."

**GATE 4→5:** developer runs `/dev-task` to start Phase 5.

---

## Phase 5 — Persist Docs (GATE 4→5 → GATE 5)

*Runs when `state.yaml` shows `phase: "5"` + `status: gate_pending` + `gates."5": pending_persist` and developer runs `/dev-task`.*

1. **Persist design artifacts to module docs** — write the long-term record of what was designed and built:

   - **`streaming-docs/documents/modules/<NN>-<module>/README.md`** — update the "Implementation Status" section:
     - Move items completed in this task from ⏳ Deferred → ✅ Complete
     - Add any new ⏳ Deferred items introduced during the task

   - **`streaming-docs/documents/modules/<NN>-<module>/features/<feature-name>.md`**

     Derive `<feature-name>` from the user story or the concrete capability — short, semantic, no ticket ID (e.g. `sign-up`, `oauth-google`, `token-refresh`, `chat-persistence`, `rate-limiting`). Ask the developer to confirm the name if ambiguous.

     - **File exists** (feature was previously partially implemented): append a dated `## <date> — <task-slug>` section with the new changes. Do not overwrite prior content.
     - **File does not exist**: create it with the full template below.

     ```markdown
     # <feature-name>

     ## Summary
     <what this feature does and why it exists — written to stay accurate over time>

     ## Implementation history
     | Date | Ticket | What changed |
     |------|--------|-------------|
     | <date> | <ID or n/a> | <one-line summary> |

     ## Design decisions
     <bullet list of non-obvious choices with reasoning — update when decisions change>

     ## Schema / API
     <current state of Prisma models and GraphQL operations for this feature — keep up to date, not append-only>

     ## Diagrams
     <Mermaid diagrams that describe the current flow — replace outdated ones rather than appending>

     ## Constraints for future features
     <invariants, patterns that must not be broken, cross-module contracts, known deferred items>
     ```
     This file is the permanent feature record. Future tasks read `features/*.md` in Phase 0b to surface conflicts.

   - **`streaming-docs/documents/modules/<NN>-<module>/api.md`** (create if absent) — for each new or changed GraphQL query/mutation/subscription/type introduced in this task, add:
     ```
     ### <OperationName>
     - Type: query | mutation | subscription
     - Auth: required / public (@Public)
     - Input: <DTO fields>
     - Returns: <type>
     - Side effects / notes: <any non-obvious behaviour>
     ```

   - **Database docs** — only if `impact.md § Database Changes` has content (new models, columns, indexes, or migrations):

     1. **Module schema doc** `streaming-docs/documents/database/<NN>-<module>.md` (create from existing docs structure if absent):
        - Add or update tables introduced/changed in this task
        - Follow existing column doc format: name, type, constraints, purpose
        - Note any invariants (e.g. soft-delete only, append-only ledger)

     2. **Sub ERD** `streaming-docs/documents/database/diagrams/<NN>-<module>-erd.puml` (create if absent):
        - Add/update entities for new/changed models
        - Show all columns, indexes, and FK relationships

     3. **Master ERD** `streaming-docs/documents/database/diagrams/00-database-overview-erd.puml` — **MANDATORY whenever sub-ERD changes**:
        - Add/update entity stub (PK + FKs only) for each affected model
        - Add/update cross-module relationship arrows
        - A stale master ERD is worse than none — never skip this step

     4. Update the index table in `streaming-docs/documents/database/README.md` if a new module doc was created.

   Only write sections that have meaningful new content — do not generate boilerplate for unchanged items.

2. Update `state.yaml`: `gates."5": docs_written`, `status: gate_pending`

Output: Say "Design artifacts persisted. Review module docs for accuracy. Run `/dev-task` to create the PR."

**GATE 5:** developer reviews docs, runs `/dev-task`.

*Runs when `state.yaml` shows `phase: "5"` + `status: gate_pending` + `gates."5": docs_written`.*

3. Update `state.yaml`: `phase: "6"`, `status: gate_pending`

---

## Phase 6 — PR

*Runs when `state.yaml` shows `phase: "6"` + `status: gate_pending` and developer runs `/dev-task`.*

1. Invoke `create-pr` (uses `plan.md` as PR description base)
2. Write `pr.md` with MR link + post-merge checklist
3. Update `state.yaml`: `status: complete`

Output: PR link in `pr.md`. Say "PR created. After merge, run `/hsd-post-merge <task-slug>` to update streaming-docs."

---

## State transitions summary

Every phase change requires an explicit `/dev-task` invocation. No phase advances automatically.

| phase | status       | gates key              | Next `/dev-task` triggers                        |
|-------|-------------|------------------------|--------------------------------------------------|
| "0"   | gate_pending | —                      | Phase 0b (Context Load)                          |
| "1"   | gate_pending | —                      | Read answered questions.md → spawn planner       |
| "1"   | gate_pending | plan_written           | Phase 2 (Impact & Design)                        |
| "2"   | gate_pending | —                      | Phase 3 (UI check)                               |
| "4"   | gate_pending | —                      | GREEN + checks cycle (Phase 4 post-mini-gate)    |
| "3"   | gate_pending | skipped                | Phase 4 (no UI path)                             |
| "3"   | gate_pending | ui_verified            | Phase 4 (UI path)                                |
| "4"   | gate_pending | checks_green           | Commit → set phase "5" pending_persist           |
| "5"   | gate_pending | pending_persist        | Phase 5 — persist docs                           |
| "5"   | gate_pending | docs_written           | Phase 6 — create PR                              |
| "6"   | gate_pending | —                      | Create PR → complete                             |

## Error recovery

If `state.yaml` shows `status: blocked`:
- Read `state.yaml notes` field for the blocker
- Surface the blocker to developer and wait for resolution before advancing

If developer runs with no existing `state.yaml`: treat as first run and require `<ticket-url-or-title>`.
