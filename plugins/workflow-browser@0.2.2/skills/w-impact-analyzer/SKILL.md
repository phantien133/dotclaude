---
description: Phase 2 helper for w-task — auto-generate domain-specific impact.md sections (DB / GraphQL / queue / cache) by inspecting schema files referenced in workflow.yaml. Replaces hand-written generic Affected-Files-only impact.md with layer-aware analysis.
argument-hint: <task-slug>
allowed-tools: Bash, Read, Write, Edit, Agent
---

# w-impact-analyzer

Enrich `impact.md` with structured per-layer sections (DB / GraphQL / queue /
cache) based on `plan.md` + schema files referenced in `workflow.yaml`. Generic
version of an internal impact analysis pattern.

Reads `.claude/workflow.yaml`:
- `project.schema_paths.prisma`
- `project.schema_paths.graphql`
- `project.module_glob`

Input: `<state_root>/<task-slug>/{plan,context}.md` + current `impact.md` skeleton.

---

## Step 1 — Build base impact.md

Always include:
- § Affected Files (from plan.md "Implementation approach")
- § Dependencies (new packages, new modules)
- § Risks (from plan.md "Risks")
- § Sequence Diagram (Mermaid happy path — auto-generate from plan.md "Implementation approach")

---

## Step 2 — Database section (if prisma schema configured)

If `schema_paths.prisma` is set AND plan.md mentions DB changes:

1. Read current `schema.prisma`.
2. From plan.md, identify model/table changes (add model, modify column, new index, drop column).
3. Write § Database Changes:
   ```markdown
   ## Database Changes

   ### New / modified models
   | Model | Change | Columns | Notes |
   |-------|--------|---------|-------|
   | <name> | add / modify / drop | <list> | <reason> |

   ### New indexes
   - <model>: <columns> (<unique?>)

   ### Migration
   `<migration name, e.g. 2026-05-14-add-stream-keys>`
   ```

4. If the change is non-trivial (>2 tables touched, or any drop), AUTO-INVOKE
   `w-adr` with title "DB schema change for <feature>" — DB shape changes are
   architecture decisions.

---

## Step 3 — GraphQL section (if graphql schema configured)

If `schema_paths.graphql` is set AND plan.md mentions API changes:

1. Glob for `*.graphql` / `*.gql` files OR `@Query()/@Mutation()` decorators
   inside `module_glob`.
2. From plan.md, list new/changed operations.
3. Write § GraphQL Schema Changes:
   ```markdown
   ## GraphQL Schema Changes

   ### Queries
   - <Name>(<args>) -> <Return>

   ### Mutations
   - <Name>(<args>) -> <Return>

   ### Subscriptions
   - <Name>(<args>) -> <Return>

   ### Types
   - <TypeName> { <fields> }

   ### Auth
   - <Operation>: <required | public | role>
   ```

---

## Step 4 — Async / Queue section

Heuristic check: scan `module_glob` for `Queue`, `Processor`, `@Process(`,
`Bull`, `bullmq`, `kafka`, `rabbitmq`, `sqs`, `pubsub` references.

If present AND plan.md mentions async work:

```markdown
## Async / Queue Impact

### New queues / topics
- <name>: <purpose>; producer = <module>; consumer = <processor>

### Modified processors
- <name>: <change>

### Failure modes
- <what happens on processor failure — DLQ? retry policy?>
```

---

## Step 5 — Cache / Redis section

Heuristic: scan for `redis`, `cache`, `Cache`, `@Cacheable` references.

If present AND plan.md mentions cache or session state:

```markdown
## Cache / State Impact

### New keys
- `<pattern>` (TTL: <duration>, purpose: <…>)

### Invalidation
- <when does X get evicted>

### Distributed locks
- <lock name + TTL>
```

---

## Step 6 — Cross-cutting section

For everything that doesn't fit above (config, env vars, shared guards,
permissions, logging events):

```markdown
## Cross-cutting

- Config: <new env var or config key>
- Auth: <new role / permission>
- Logging: <new event / metric>
- Other: <…>
```

---

## Step 7 — Auto-diagrams

Always include a Mermaid sequence diagram for the happy path.

Auto-add when triggers met:
- `>3 services interacting` in plan.md → extra Mermaid sequence per sub-flow
- State machine logic (terms: lifecycle, status, state, FSM) → Mermaid
  `stateDiagram-v2`
- New DB models (Step 2 produced rows) → trigger `w-db-doc` later in Phase 5
  for sub-ERD; for Phase 2, add a brief Mermaid `erDiagram` stub inline

If the task is borderline (moderate complexity), pause once with options:
```
Diagrams to generate:
  A) Mermaid sequence (extra sub-flow)
  B) Mermaid state diagram
  C) Inline erDiagram
  D) Skip extras

Reply A/B/C/D or comma-separated subset, then run /w-task.
```

---

## Step 8 — Write impact.md + confirm

Write/replace `<state_root>/<task-slug>/impact.md` with the enriched structure.

Print:
```
impact.md analyzed:
  Sections: Affected Files | Dependencies | Risks | Sequence
  Plus: <DB? GraphQL? Async? Cache? Cross-cutting?>
  Diagrams: <list>
  ADR triggered: <ADR-NNN or "none">

Review impact.md before /w-task advances Phase 2.
```
