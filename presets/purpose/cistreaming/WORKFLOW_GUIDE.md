# cistreaming — Developer Workflow Guide

Complete reference for the `cistreaming` Claude Code preset: all slash commands, skills, agent table, full phase flows for `/w-task` and `/w-fix`, free-prompt guide, and setup config.

→ **[README.md](README.md)** — preset overview, what's bundled  
→ **[AGENTS.md](AGENTS.md)** — agent orchestration rules, security/coding/testing guidelines

---

## Quick Reference

### Slash Commands

| Command | When to use |
|---------|-------------|
| `/w-setup` | One-time setup — creates `.claude/workflow.yaml` for the project |
| `/w-task <issue-url \| #N \| title>` | Start a new feature task (full 8-phase flow) |
| `/w-task` | Advance to next phase (run after each gate) |
| `/w-fix <issue-url \| #N \| description>` | Start a small bug fix (≤3 files, <2h, no schema change) |
| `/w-fix` | Advance to next fix phase |
| `/w-status` | Show current task state without advancing |
| `/w-reset <task-slug>` | Reset task to phase 0 or wipe folder entirely |
| `/w-pr <task-slug>` | Create PR (runs `w-doc-gate` invariant check first) |
| `/f-setup` | One-time Figma MCP / export path configuration |
| `/f-import <figma-url>` | Import Figma design → code (MCP or export) |
| `/f-ui-kit <module>` | Generate shared UI kit components from Figma |
| `/f-page <module>` | Generate page scaffold from Figma |
| `/f-review <module>` | Review implementation against Figma design |
| `/hsd-story-lint <story.md>` | Validate story file before starting a task |
| `/hsd-post-merge` | Legacy: update streaming-docs after a merged PR |
| `/w-document-build-up <docs-root>` | One-time: backfill streaming-docs from existing code |

---

### Skills Invoked by `w-task` (automatic — not called directly)

| Skill | Phase | Role |
|-------|-------|------|
| `w-context-load` | 0b | Module-aware context: reads README + feature records, surfaces OQs |
| `w-oq-check` | 0b | Flags blocking Open Questions before implementation starts |
| `w-impact-analyzer` | 2 | Generates `impact.md` — DB/GraphQL/Queue/Cache/Cross-cutting sections |
| `w-adr` | 2 | Appends Architecture Decision Record for non-trivial decisions |
| `w-test-stubs` | 4 | Writes layer-aware test boilerplate (unit/graphql/bullmq/nestjs/nextjs/integration) |
| `w-feature-record` | 5 | Creates/appends `features/<feature-name>.md` |
| `w-api-doc` | 5 | Updates module `api.md` with new GraphQL/REST operations |
| `w-db-doc` | 5 | Writes module schema doc + sub-ERD + syncs master ERD |
| `w-doc-gate` | 6 (via `/w-pr`) | Pre-PR invariant: blocks if code changes lack matching doc updates |
| `w-checkpoint` | 4 | Creates RED / GREEN TDD checkpoint commits |

---

### Agents (auto-spawned — not called directly)

| Agent | Spawned by | Role |
|-------|-----------|------|
| `planner` | `w-task` Phase 1 | Generates comprehensive `plan.md` from intake + context + questions |
| `tdd-guide` | `w-task` Phase 4 | Enriches test assertions with edge cases and mocking strategies |
| `code-reviewer` | `w-task` Phase 4 | Reviews implementation — resolves CRITICAL/HIGH issues before commit |
| `code-explorer` | `w-document-build-up` | Surveys codebase structure for bootstrap documentation |
| `code-architect` | `w-document-build-up` | Extracts architectural decisions from code |
| `code-simplifier` | (available) | Refactoring assistant for cleanup tasks |

See [AGENTS.md](AGENTS.md) for orchestration rules, when to spawn each agent proactively, and platform-specific security/coding/testing guidelines.

---

## Full Flow: `/w-task`

Feature development workflow with 8 phases. The workflow **only advances when you explicitly run `/w-task`**. Between phases you can freely chat, ask questions, and request corrections — Claude will respond without advancing the state machine.

```
Issue / title
     │
  Phase 0  ──GATE 0──▶  Phase 0b ──auto──▶  Phase 1  ──GATE 1──▶
  Intake                 Context             Plan        Plan review
     │                                                      │
  Phase 6  ◀──GATE 5──  Phase 5  ◀──GATE 4b── Phase 4  ◀──GATE 2──
  PR            Docs     Docs persist  Commit    TDD         Impact
```

---

### Phase 0 — Intake

**How to start:**
```
/w-task https://pm.hilab.cloud/hilab/browse/CISTREAMIN-42/
/w-task #42
/w-task "add gift notification banner"
```

**What Claude does:**
1. Fetches the ticket (Plane MCP, GitHub CLI, or free text)
2. Derives a task slug: `CISTREAMIN-42-gift-notification-banner`
3. Creates `streaming-docs/workflow/<task-slug>/intake.md`
4. Shows a summary card and pauses

**What you see (gate pause):**
```
Please confirm (or correct) before we proceed:

1. Title: Add gift notification banner — correct?
2. Any additional context, constraints, or related files?
3. If the description above is incomplete, paste the correct one now.

Reply in chat, then run /w-task when ready.
```

**Your role at GATE 0:**
- Confirm the title is correct
- Add missing context, acceptance criteria, or constraints that weren't in the ticket
- Paste the full description if it was truncated
- Mention related issues, prior work, or files you already know are affected

**Free-prompt examples:**
```
The banner should only show for the recipient, not the sender.
Related to CISTREAMIN-38 (gift system). Affected area: streaming-web/src/features/gift/.
Skip mobile for now — web only.
```

**Run `/w-task` to advance →**

---

### Phase 0b — Context Load (automatic)

**What Claude does (no gate — runs immediately):**
1. Reads `streaming-docs/documents/modules/<NN>-<module>/README.md`
2. Reads `features/*.md` to surface prior implementation decisions
3. Runs `w-oq-check` — if a blocking OQ is found, **stops and surfaces it** (you must resolve before continuing)
4. Reads relevant source files
5. Writes `context.md` with: Task Summary, Module Snapshot, Relevant Files, Patterns Observed, Available Utilities, Previous Feature Decisions, Known Constraints, Suggested Approach
6. Creates/updates `workflow-links.md` row for this task

**Output:** `"Context loaded. Run /w-task to start planning."`

---

### Phase 1 — Plan

**What Claude does:**
1. Reads `intake.md` + `context.md`
2. Writes `questions.md` with: what was understood, clarifying questions, suggested missing scenarios

**Gate pause — you fill `questions.md`:**

Open `streaming-docs/workflow/<task-slug>/questions.md` in your editor. Fill in the answers directly in the file. This is the critical checkpoint before any implementation shape is decided.

**Good answers include:**
- Edge cases: what happens if the gift was already seen? if the stream ended?
- Acceptance criteria for each scenario
- Integration points: does this touch the notification queue? the gift service?
- What NOT to build in this iteration

**Run `/w-task` to advance →**

**What Claude does next (GATE 1b):**
1. Reads answered `questions.md`
2. Spawns `planner` agent → generates `plan.md` (Feature scope, Implementation approach per layer, Out of scope, Dependencies, Risks)
3. Shows: `"Review plan.md. Run /w-task to approve and proceed."`

**Your role at GATE 1b:**
- Read `plan.md` carefully — this defines what gets built
- In free prompt: challenge assumptions, request scope changes, add missing layers
- If the plan is missing the WebSocket subscription layer, say so before approving

**Free-prompt examples:**
```
The plan is missing Redis pub/sub fanout — add that to the implementation approach.
Remove the admin analytics section — out of scope for this ticket.
The sequence diagram should show the BullMQ job, not a direct DB write.
```

**Run `/w-task` when plan is approved →**

---

### Phase 2 — Impact & Design (automatic)

**What Claude does:**
1. Invokes `w-impact-analyzer` → generates `impact.md`:
   - § Affected Files
   - § Dependencies + Risks
   - § Sequence Diagram (Mermaid)
   - § Database Changes (if plan touches Prisma schema)
   - § GraphQL Schema Changes (if plan touches API)
   - § Async / Queue Impact (BullMQ/Redis detected)
   - § Cache / State Impact
   - § Cross-cutting (config, auth, logging)
2. May auto-invoke `w-adr` for significant architectural decisions (e.g., new cross-module async contract)

**Gate pause:**
```
impact.md is ready. Before approving:
• Challenge assumptions — does the sequence diagram match your mental model?
• Update the design — if something is wrong, say so in chat and I'll revise.

This is the last checkpoint before implementation shape is committed.
Run /w-task when satisfied.
```

**Your role at GATE 2 — most important review before coding:**
- Read the sequence diagram — does the data flow match your understanding?
- Check § Database Changes — is the schema correct? Are indexes included?
- Check § GraphQL Schema Changes — are mutation names correct? Correct nullable fields?
- Check § Affected Files — are there files missing from the list?
- Request revisions in free prompt before approving

**Free-prompt examples:**
```
The sequence diagram is missing the WebSocket subscription step after BullMQ processes the job.
Add `GiftNotificationEntity` to the affected files — it needs a new field.
The `giftId` field in the GraphQL type should be non-nullable.
```

**Code review is recommended here too:** before implementation starts, ask Claude to review the design in `impact.md` for any architectural anti-patterns.

**Run `/w-task` to approve →**

---

### Phase 3 — UI (conditional)

**Condition:** only triggered if `plan.md` mentions UI changes.

**If no UI changes:** Claude skips automatically → says `"No UI changes detected. Run /w-task to start TDD."`

**If UI changes detected:**
```
UI changes detected in plan.md.

If you have a Figma design ready:
  /f-import <figma-url>                   → MCP import (recommended)
  /f-import --export <folder>             → import from Figma export folder

Run /f-setup first if Figma has not been configured for this project.
When done (or if skipping UI assets), run /w-task to proceed to TDD.
```

Run Figma commands if needed, then run `/w-task` to continue.

---

### Phase 4 — TDD

**What Claude does (automatic to GATE 4 mini):**
1. Invokes `w-test-stubs` → writes layer-aware test boilerplate for each affected file:
   - `unit` → Jest with mocked PrismaService
   - `graphql` → Apollo Server integration test
   - `bullmq` → mocked queue + real Redis integration
   - `nestjs` → NestJS testing module
   - `nextjs` → React Testing Library / Playwright
   - `integration` → docker-compose test stack
2. Spawns `tdd-guide` agent → enriches assertions with edge cases and stack-specific mocking
3. Runs tests → confirms RED (all failing)
4. Writes `tests.md`

**Gate pause (mini):**
```
Review tests.md — confirm test structure covers impact.md scope. Run /w-task to approve.
```

**Your role:**
- Confirm each affected file has a test file
- Check that edge cases from `questions.md` are covered
- Add missing test cases in free prompt

**Run `/w-task` to approve →**

**What Claude does (to GATE 4a):**
1. Creates RED checkpoint commit (`chore: RED checkpoint — <task-slug>`)
2. Invokes `tdd-workflow` skill → RED → GREEN → refactor cycle
3. Runs tests → confirms GREEN
4. Creates GREEN checkpoint commit
5. Runs typecheck, lint, test coverage
6. **Spawns `code-reviewer` agent** → reviews all affected files from `impact.md`:
   - CRITICAL/HIGH issues: resolved immediately, tests re-run
   - MEDIUM items: documented in `tests.md § Code Review Notes`
7. Writes `verify.md`:
   ```
   | Check        | Result | Notes                    |
   |--------------|--------|--------------------------|
   | typecheck    | ✅     |                          |
   | lint         | ✅     |                          |
   | tests        | ✅     | 87% coverage             |
   | code review  | ✅     | 2 CRITICAL resolved      |
   ```

**Gate pause (GATE 4a):**
```
Code is GREEN and checks pass. Review verify.md and diff. Run /w-task to commit.
```

**Your role at GATE 4a — code review gate:**
- Read `verify.md` — all checks must be green before advancing
- Run `git diff` or review the diff in your IDE
- If you see issues, say so in free prompt — Claude will fix and re-run checks
- This is the **primary code review gate** — be thorough

**Free-prompt examples:**
```
The GiftNotificationService.create() method should use a transaction — fix that.
Add a null guard on streamId before the BullMQ dispatch.
The test for the "stream already ended" edge case is missing — add it.
```

**Recommended: request a second code review pass:**
```
Run another code-reviewer pass focused on error handling and edge cases only.
```

**Run `/w-task` to commit →**

Claude commits implementation:
```bash
git add <files from impact.md>
git commit -m "feat(gift): add gift notification banner for recipients"
```

**Run `/w-task` to advance to docs →**

---

### Phase 5 — Persist Docs

**What Claude does:**
1. Invokes `w-feature-record` → creates/appends `features/gift-notification.md`
2. Updates module README Implementation Status (✅/⏳)
3. Invokes `w-api-doc` → appends new GraphQL operations to `api.md`
4. Invokes `w-db-doc` → writes schema doc + sub-ERD + **mandatory** master ERD sync
5. Commits docs separately:
   ```bash
   git commit -m "docs(gift): persist gift-notification design from CISTREAMIN-42-..."
   ```

**Gate pause:**
```
Docs persisted and committed. Review changes, then run /w-task to create the PR.
```

**Your role:**
- Review the feature record for accuracy
- Check that the API doc matches the actual GraphQL schema
- Verify the sub-ERD and master ERD are in sync
- Request corrections in free prompt

**Free-prompt examples:**
```
The feature record is missing the "stream already ended" edge case — add it to § Constraints.
The GiftNotification type in api.md should be marked as nullable on streamId.
```

**Run `/w-task` to advance →**

---

### Phase 6 — PR

**What Claude says:**
```
Run /w-pr <task-slug> to create the PR (w-doc-gate runs first).
```

**Run `/w-pr <task-slug>` →**

`w-doc-gate` checks:
- Every module touched in CODE has a doc update in the branch
- Every sub-ERD change is accompanied by a master ERD update

If gate fails: Claude prints the missing doc paths. Return to Phase 5 (`/w-task`) to fill the gaps, then re-run `/w-pr`.

If gate passes: PR is created as a draft with the task slug, summary from `plan.md`, and both commits (code + docs) in the same branch.

---

## Full Flow: `/w-fix`

Lightweight workflow for bug fixes and small changes. Use when: 1–3 files affected, no DB schema changes, no new API surface, estimated <2h.

```
Description → Phase 0 ──GATE 0──▶ Phase 1 ──GATE 1──▶ Phase 2 ──GATE 2──▶ /w-pr
              Intake               Fix impl             Commit              PR
```

---

### Phase 0 — Intake & Locate

**How to start:**
```
/w-fix "fix typo in stream-key error message"
/w-fix #87
/w-fix https://pm.hilab.cloud/hilab/browse/CISTREAMIN-87/
```

**What Claude does:**
1. Fetches ticket or uses description as-is
2. Derives task slug: `87-stream-key-error-typo`
3. Searches codebase for affected files (targeted grep — max 5 files)
4. Forms a root cause hypothesis
5. **Scope check** — if >3 files, DB schema change, or >2h estimate: stops and says `"Use /w-task instead."`
6. Writes `intake.md` with: description, root cause hypothesis, affected files, approach
7. Shows summary card and pauses

**Gate pause:**
```
Root cause: <hypothesis>
Files:      <list>
Approach:   <one-line summary>

Confirm or correct (reply in chat), then run /w-fix to implement.
```

**Your role at GATE 0:**
- Confirm or correct the root cause hypothesis
- Add or remove files from the affected list
- Clarify the expected behavior after the fix

**Run `/w-fix` to advance →**

---

### Phase 1 — Fix (automatic)

**What Claude does:**
1. Reads your reply from GATE 0, updates intake if corrected
2. Implements the fix (only files in `intake.md § Affected Files`)
3. Runs existing tests (does not write new tests)
4. Runs typecheck + lint on affected files
5. Writes `fix.md`:
   ```
   | File    | What changed          |
   |---------|-----------------------|
   | path    | <one-line summary>    |

   Test results: PASS / FAIL
   | typecheck | ✅ |
   | lint      | ✅ |
   ```

**Gate pause:**
```
Fix implemented. Review the diff and fix.md. Run /w-fix to commit.
```

**Your role at GATE 1 — the code review gate for fixes:**
- Run `git diff` — verify only the intended lines changed
- Check `fix.md` — test results must be PASS
- If something looks wrong, say so in free prompt

**Free-prompt examples (w-fix gate 1):**
```
The fix is correct but also update the error message in the Spanish i18n file.
Add a type guard — streamKey can be undefined here.
```

**Recommended: always request a quick code review:**
```
Do a quick code-reviewer pass on the diff before committing.
```

**Run `/w-fix` to commit →**

---

### Phase 2 — Commit & Docs (automatic)

**What Claude does:**
1. Commits affected files:
   ```bash
   git commit -m "fix(stream): correct stream-key error message wording"
   ```
2. Optionally appends a row to the feature doc Implementation History (if `docs_root` is set and the fix is in a named feature)

**Gate pause:**
```
Committed. Run /w-fix to create the PR.
```

**Run `/w-fix` →** then **`/w-pr <task-slug>`** to create the PR.

---

## Free-Prompt Guide

Every gate in `w-task` and `w-fix` pauses and waits for you to run the command again. **During this pause, type anything — Claude responds without advancing the phase.**

### When to use free prompt

| Situation | What to type |
|-----------|-------------|
| Missing context | Additional constraints, related tickets, known limitations |
| Wrong assumption | Correct misunderstood requirements |
| Request a revision | Ask Claude to update `plan.md`, `impact.md`, or `intake.md` |
| Ask a question | "What does this pattern mean?" / "Why is this approach preferred?" |
| Request code review | "Run a code-reviewer pass on the diff now" |
| Add a test case | "Add a test for the case where the user is banned" |
| Scope correction | "Remove X from scope — defer to next ticket" |
| Architectural challenge | "This approach bypasses the AppException hierarchy — fix it" |

### Recommended practices at each gate

**GATE 0 (Intake):** Always add context that isn't in the ticket — known affected files, related issues, scope constraints.

**GATE 1 / 1b (Plan):** Fill `questions.md` thoroughly. Challenge the plan's scope before approving — changes after Phase 2 are expensive.

**GATE 2 (Impact):** This is the most important gate. Read the sequence diagram carefully. Request revisions until the design matches your mental model. Ask for a design review:
```
Review impact.md for any architectural issues against the hilab-streaming-rules.
```

**GATE 4 mini (Test structure):** Confirm edge cases from `questions.md` are covered as test cases.

**GATE 4a (Code review):** Always review the diff. Request additional review passes if needed:
```
Run another code-reviewer pass — focus on error handling and Prisma transactions.
```
Fix all CRITICAL and HIGH issues before running `/w-task` to commit.

**GATE 5 (Docs):** Verify feature records and API docs are accurate — these are the source of truth for future developers.

### Requesting a code review at any point

You can ask for a `code-reviewer` agent pass at any gate:

```
Run a code-reviewer pass on the current diff.
```

```
Review streaming-api/src/modules/gift/gift-notification.service.ts for security issues.
```

```
Check if there are any missing error handlers in the affected files.
```

The `code-reviewer` agent is available throughout the session — not just during Phase 4. Use it proactively after any implementation change.

### Requesting revisions to workflow documents

```
Update plan.md — remove the analytics section and add a WebSocket subscription step.
```
```
Revise impact.md § Sequence Diagram — the fanout goes through BullMQ, not direct Redis pub.
```
```
Add an OQ to context.md: should gift notifications survive stream reconnect?
```

### Advancing vs. staying in phase

| Your input | What happens |
|-----------|-------------|
| `/w-task` (empty) | Advances to the next phase |
| `/w-task continue` | Same as above |
| Any text other than the above | Claude responds and stays in current phase |
| `/w-task <new issue URL>` | Starts a new task (saves current state first) |

---

## Setup Reference

Setup commands: see [README.md § Setup](README.md#setup).  
External tools and MCP servers (Figma MCP, Plane MCP, mgrep, glab): see [README.md § Dependencies](README.md#dependencies).

Below are the full `.claude/workflow.yaml` fields consumed by the `w-*` skills.

### `.claude/workflow.yaml` key fields

```yaml
issue_tracker:
  type: plane          # github | plane | jira | linear | none
  url: https://pm.hilab.cloud
  workspace: hilab
  project: CISTREAMIN
  mcp_available: true

workflow:
  state_root: streaming-docs/workflow
  module_docs_root: streaming-docs/documents/modules
  feature_records_subdir: features
  api_docs_filename: api.md
  workflow_links_filename: workflow-links.md
  db_docs_root: streaming-docs/documents/database
  diagrams_root: streaming-docs/documents/database/diagrams
  master_erd_path: streaming-docs/documents/database/diagrams/00-database-overview-erd.puml
  oq_docs_path: streaming-docs/documents/overview/open-questions.md
  adr_docs_path: streaming-docs/documents/overview/architecture-overview.md

project:
  test_command: npx jest
  typecheck_command: npx tsc --noEmit
  lint_command: npx eslint src/
  module_glob: src/modules/*
  schema_paths:
    prisma: prisma/schema.prisma
    graphql: src/**/*.graphql
  test_layers: [unit, integration, graphql, bullmq, nestjs, nextjs]

pr:
  default_branch: main
  draft: true
```

---

## Doc Invariant Rules

`w-doc-gate` runs at `/w-pr` time and **blocks PR creation** if any rule below is violated. Docs and code ship in the same branch — two separate commits, one PR.

| Rule | Check |
|------|-------|
| Module code touched | Corresponding `README.md` Implementation Status updated |
| Feature implemented | `features/<feature-name>.md` created or updated |
| GraphQL/REST change | `api.md` updated with new operations |
| DB migration | `<NN>-<module>.md` updated + sub-ERD updated |
| Sub-ERD changed | Master ERD (`00-database-overview-erd.puml`) **must** be synced |
| Task in-progress | `workflow-links.md` has a row for the current task |

To skip (with warning in PR body): `/w-pr <task-slug> --skip-doc-gate`

---

## Common Patterns

### Start a Plane ticket
```
/w-task CISTREAMIN-42
/w-task https://pm.hilab.cloud/hilab/browse/CISTREAMIN-42/
```

### Check current status mid-session
```
/w-status
```

### Resume after a break
```
/w-task
```
(Claude reads `state.yaml` and resumes from the current gate)

### Fix a small bug
```
/w-fix "null pointer in StreamKeyService when userId is missing"
```

### Fix escalates to feature task
If Claude says `"This is beyond w-fix scope"`:
```
/w-task "fix null pointer in StreamKeyService — requires auth guard refactor"
```

### Reset a task and start over
```
/w-reset CISTREAMIN-42-gift-notification-banner
```
