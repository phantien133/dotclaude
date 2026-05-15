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
- `workflow.state_root` → where `state.yaml` + per-task md files live.
  Default `.workflow` (gitignored) for flat layout. Under the **streaming-docs
  convention** this is `<docs_root>/workflow` (committed alongside docs).
- `workflow.docs_root` → null means skip Phase 5
- `workflow.module_docs_root`, `feature_records_subdir`, `api_docs_filename`,
  `workflow_links_filename` — drive Phase 0b context load + Phase 5 doc persistence
- `workflow.db_docs_root`, `diagrams_root`, `master_erd_path` — drive Phase 5 DB pipeline
- `workflow.oq_docs_path`, `adr_docs_path` — drive OQ surfacing (Phase 0b) + ADR generation (Phase 2)
- `project.test_command`, `.typecheck_command`, `.lint_command`
- `project.module_glob`, `schema_paths.{prisma,graphql}`, `test_layers` — drive
  Phase 0b module detection, Phase 2 impact analysis, Phase 4 test stubs
- `pr.default_branch`, `.draft`, `.template`

**Path convention — streaming-docs vs flat layout**

State and docs are two **separate** concerns. They MAY share a parent (the
streaming-docs convention puts them as siblings under `<docs_root>/`) but they
are configured independently — w-task always uses the explicit config fields,
never inference.

| Concern | Config field | Streaming-docs example | Flat-layout example |
|---|---|---|---|
| State (this task's working files) | `state_root` | `streaming-docs/workflow` | `.workflow` |
| Module docs | `module_docs_root` | `streaming-docs/documents/modules` | `docs/modules` |
| DB docs | `db_docs_root` | `streaming-docs/documents/database` | `docs/database` |
| OQ doc | `oq_docs_path` | `streaming-docs/documents/overview/open-questions.md` | `docs/open-questions.md` |
| ADR doc | `adr_docs_path` | `streaming-docs/documents/overview/architecture-overview.md` | `docs/adr.md` |

For task `CISTREAMIN-11-sign-up-api` on a streaming-docs-convention project, w-task
creates these paths:
- State: `streaming-docs/workflow/CISTREAMIN-11-sign-up-api/{intake,context,plan,impact,tests,verify,pr}.md` + `state.yaml`
- Module docs touched (Phase 5):
  - `streaming-docs/documents/modules/01-auth/README.md` (update Implementation Status)
  - `streaming-docs/documents/modules/01-auth/features/sign-up.md` (create or append)
  - `streaming-docs/documents/modules/01-auth/api.md` (append SignUp mutation)
  - `streaming-docs/documents/modules/01-auth/workflow-links.md` (append task row)

**Per-phase helper skills** (invoked when the relevant config fields are set;
silently skipped otherwise):

| Phase | Helper skills |
|-------|---------------|
| 0b | `w-context-load`, `w-oq-check` |
| 2 | `w-impact-analyzer`, `w-adr` |
| 4 | `w-test-stubs` |
| 5 | `w-feature-record`, `w-api-doc`, `w-db-doc` |
| 6 | `w-doc-gate` (called from `/w-pr` — see Phase 6) |

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

**If `workflow.module_docs_root` is SET → use module-aware context load:**

1. **Invoke skill** `w-context-load <task-slug>`:
   - Reads `<module_docs_root>/<NN>-<module>/README.md` to get Implementation Status
   - Reads `<module_docs_root>/<NN>-<module>/<feature_records_subdir>/*.md` to surface
     prior constraints
   - Auto-invokes `w-oq-check <module>` to flag blocker OQs
   - Reads code scoped by README "✅ Complete" list
   - Writes `context.md` with structured sections (Task Summary, Module Snapshot,
     Relevant Files, Patterns Observed, Available Utilities, Previous Feature
     Decisions, Known Constraints, Suggested Approach)
   - Creates/updates `workflow-links.md` row

   If `w-oq-check` returns non-zero (blocker found): pause, write
   `state.yaml.status: blocked`, surface the OQ, and wait for developer.

**If `workflow.module_docs_root` is NULL → fall back to generic git-grep load:**

1. **File inventory:**
   ```bash
   git ls-files | head -300
   ```
2. **Keyword grep:** extract 3-5 keywords, run `git grep -l "<keyword>"` per keyword.
3. **Read top 3-5** relevant files (scope by `project.src_dirs` if set).
4. **Write context.md** with the minimal generic template (Task Summary, Relevant
   Files, Patterns Observed, Suggested Approach — no module-specific sections).

**In both branches:**

5. Update `state.yaml`:
   ```yaml
   phase: "1"
   status: gate_pending
   intake_confirmed: true
   module: <name or null>
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

2. **Invoke skill** `w-impact-analyzer <task-slug>` — produces structured
   `impact.md` with layer-aware sections:
   - § Affected Files (always)
   - § Dependencies, § Risks, § Sequence Diagram (always)
   - § Database Changes (if `schema_paths.prisma` set and plan touches DB)
   - § GraphQL Schema Changes (if `schema_paths.graphql` set and plan touches API)
   - § Async / Queue Impact (heuristic — BullMQ/Kafka/etc. detected)
   - § Cache / State Impact (heuristic — Redis/Cache detected)
   - § Cross-cutting (config, auth, logging)
   - Auto-generates extra Mermaid diagrams when triggers met (>3 services,
     state machine logic, new data models).

   The analyzer may auto-invoke `w-adr` if it detects a non-trivial architectural
   decision (e.g. DB schema change touching >2 tables, new cross-module async
   contract).

3. **Manual ADR opportunity** — if a decision surfaced during the impact analysis
   that wasn't auto-captured, invoke `w-adr <task-slug> "<decision-title>"`
   to append it to `adr_docs_path`.

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

1. **Invoke skill** `w-test-stubs <task-slug>` — classifies each affected file
   by layer (unit / graphql / bullmq / nestjs / nextjs / integration) and writes
   layer-appropriate test boilerplate with correct imports, mocking setup, and
   intentionally failing assertions (RED).

   The skill respects `project.test_layers` from workflow.yaml and skips layers
   not enabled. If a test file already exists, it is preserved (never overwritten).

2. **Spawn `tdd-guide` agent** — pass:
   - The skeletons just written by `w-test-stubs`
   - `impact.md § Affected Files`
   - `plan.md`
   - Instruction: enrich the assertions with missing edge cases, stack-specific
     mocking strategies, and integration scenarios. Do NOT rewrite the import
     boilerplate — w-test-stubs already chose the right layer per file.

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

Read doc-related fields from `workflow.yaml`.

**If `docs_root` is null AND `module_docs_root` is null:** skip entirely.
Update `state.yaml`: `gates.5: skipped`, `phase: "6"`, `status: gate_pending`.
Output: "Doc roots not configured — skipping. Run `/w-task` to create the PR."

**Otherwise — invoke per-target helper skills (each skill is a no-op if its
own config field is null):**

1. **Feature record** — if `module_docs_root` + `feature_records_subdir` set:
   - Derive `<feature-name>` from intake.md (kebab-case, capability not ticket
     ID). Pause once to let developer confirm if ambiguous.
   - Invoke `w-feature-record <task-slug> <feature-name>` → creates or appends
     `<module_docs_root>/<NN>-<module>/features/<feature-name>.md`.

2. **Module README update** — if `module_docs_root` set:
   - Update Implementation Status: move items completed in this task from
     ⏳ Deferred → ✅ Complete; add new ⏳ Deferred items introduced.
   - Update Depends on / Blocks if cross-module deps changed.
   - (No dedicated helper skill — this is an inline edit of the existing README.)

3. **API doc** — if `module_docs_root` + `api_docs_filename` set AND impact.md
   has § GraphQL Schema Changes / § REST API Changes:
   - Invoke `w-api-doc <task-slug>` → appends/replaces operation sections in
     `<module_docs_root>/<NN>-<module>/<api_docs_filename>`.

4. **DB docs + sub-ERD + master ERD** — if `db_docs_root` set AND impact.md
   has § Database Changes:
   - Invoke `w-db-doc <task-slug>` → writes module schema doc, sub-ERD, and
     **mandatorily** syncs the master ERD. If `master_erd_path` is null while
     `diagrams_root` is set, the skill aborts with an error — fix workflow.yaml.

5. **Stage doc changes** — add all written files to the staging area in a
   separate commit:
   ```bash
   git add <module_docs_root>/<NN>-<module>/ <db_docs_root>/<NN>-<module>.md \
           <diagrams_root>/<NN>-<module>-erd.puml <master_erd_path> \
           <adr_docs_path> <oq_docs_path>
   git commit -m "docs(<module>): persist <feature-name> design from <task-slug>"
   ```
   Doc commit is separate from code commit (Phase 4b) so reviewers can read
   them independently, but both ship in the same PR.

Update `state.yaml`: `gates.5: docs_written`, `status: gate_pending`.

Output: "Docs persisted and committed. Review changes, then run `/w-task` to
create the PR (which will trigger w-doc-gate)."

**GATE 5:** developer reviews + runs `/w-task`.

Update `state.yaml`: `phase: "6"`, `status: gate_pending`.

---

## Phase 6 — PR

*Triggers when `phase: "6"` + `status: gate_pending`.*

`/w-pr` (Phase 6) will internally invoke `w-doc-gate <task-slug>` before
opening the PR. The doc gate verifies:
- Every module touched (code changes under `module_glob`) has a corresponding
  doc update in the branch diff
- If `master_erd_path` is configured, any sub-ERD change is accompanied by
  a master ERD update in the same branch

If the gate fails, `/w-pr` blocks PR creation and prints the missing doc paths
— developer must return to Phase 5 (`/w-task`) to fill the gap.

Output: "Run `/w-pr <task-slug>` to create the PR (w-doc-gate runs first)."

**GATE 6:** developer runs `/w-pr <task-slug>`.

Update `state.yaml`: `phase: "6"`, `status: complete`, `last_updated: <timestamp>`.

Output: "Task complete. Docs ship with code in this PR — no post-merge sync needed."

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
