---
description: Run post-merge doc updates for a completed dev-task task — updates streaming-docs module README, workflow-links.md, database docs, OQs, and ADRs.
---

# hsd-post-merge

Run post-merge documentation updates for task `$ARGUMENTS` (task-title).

**When to run:** After the GitLab MR for this task has been merged to master.

## Steps

1. Read `streaming-docs/workflow/<task-title>/impact.md` — determine what changed
2. Read `streaming-docs/workflow/<task-title>/plan.md` — understand final implementation

**Always:**

3. Update `streaming-docs/documents/modules/<module>/README.md`:
   - Reflect new services, resolvers, mutations, subscriptions added
   - Update "Status" section to reflect what is now implemented
   - Update "Depends on / Blocks" if cross-module dependencies changed

4. Update `streaming-docs/documents/modules/<module>/workflow-links.md`:
   - Find the row for `<task-title>` and change `status` from `in-progress` to `complete`

**If impact.md had DB changes:**

5. Update `streaming-docs/documents/database/<NN>-<module>.md`:
   - Add new tables / columns
   - Update existing table documentation
   - Confirm PlantUML ERD in `diagrams/` reflects new schema (update if needed)

**If impact.md had resolved OQs:**

6. Update `streaming-docs/documents/overview/open-questions.md`:
   - Move resolved OQ entries from "Active" to "Resolved" section
   - Add reference to ADR or PR where resolution was documented

7. Append ADR entry to `streaming-docs/documents/overview/architecture-overview.md` for each resolved OQ that involved an explicit design decision

**If complex design was introduced (per streaming-docs-governance rule):**

8. Create companion document in module folder:
   - >3 service interactions → `design.md`
   - State machine → `state-machine.md` + PlantUML in `diagrams/`
   - Non-obvious config → `config.md`
   - External integration → `integration.md`

**Always:**

9. Print staging migration checklist if DB changes found:
   ```
   Staging migration checklist:
   - [ ] Run: prisma migrate deploy (staging env)
   - [ ] Verify: <table-names> created/altered correctly
   - [ ] Smoke test: <key-mutation> returns expected result
   ```

## Output

Summary of all files updated. If any step was skipped (no DB changes, no OQs, etc.) — say so explicitly.
