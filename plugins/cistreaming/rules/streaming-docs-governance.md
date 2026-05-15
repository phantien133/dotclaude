---
description: Documentation governance for Hilab streaming — module docs are always updated after implementation; complex designs require companion documents; each module maintains a workflow task history.
globs: ["**/*.ts", "**/*.tsx", "**/*.prisma"]
---

# Streaming Docs Governance

**Core principle:** documents are a post-implementation obligation. Code ships → docs ship. Never leave `streaming-docs` reflecting a state older than the current implementation.

---

## § When to update module docs

Update `streaming-docs/documents/modules/<NN>-<module>/README.md` after ANY of:

| Trigger | Target |
|---------|--------|
| Feature task completed (via `/dev-task`) | `features/<feature-name>.md` — create or update; ticket ID recorded inside, not in filename |
| New service / resolver / controller / processor | Module README — Implementation Status section |
| GraphQL schema change (query / mutation / subscription / type) | Module `api.md` (create if absent) |
| New Prisma model or migration | Module README + `documents/database/<NN>-<module>.md` + `diagrams/<NN>-<module>-erd.puml` + **master ERD** `diagrams/00-database-overview-erd.puml` (mandatory) |
| Cross-module dependency added or removed | Module README — Depends on / Blocks |
| OQ resolved | Move from `open-questions.md` → ADR entry in `architecture-overview.md` |
| New architectural decision | Append ADR entry to `architecture-overview.md` |
| Queue or pub-sub channel added | `features/<feature-name>.md` § Constraints + README async section |

**Path note:** Code dir is `src/modules/<module>/` (no NN prefix); doc dir is `documents/modules/<NN>-<module>/` (with NN). Keep these distinct — never confuse them.

**In workflow mode (`/dev-task`):** `hsd-post-merge` enforces this automatically.

**In manual dev sessions:** Claude MUST prompt the developer to confirm doc update at the end of any session where module code changed.

---

## § What requires a companion document

**Per-feature records** go in `features/<feature-name>.md` (e.g. `sign-up.md`, `oauth-google.md`, `chat-persistence.md`) — named after the user story or capability, not the ticket ID. Ticket IDs are tracked inside the file in the Implementation history table. A file is created on first implementation and updated (append history row + revise current-state sections) on subsequent changes. Phase 0b reads all `features/*.md` to surface conflicts before starting a new task.

Additional companion documents are required when:

| Situation | Document to create |
|-----------|-------------------|
| Business logic with >3 service interactions | `design.md` |
| State machine (stream session, wallet lifecycle) | `state-machine.md` + PlantUML sequence in `diagrams/` |
| Non-obvious configuration (why this guard, why this TTL) | `config.md` |
| External system integration (SRS callbacks, HeyGen, PSP) | `integration.md` |
| New or changed GraphQL operations | `api.md` — one section per operation |
| Pattern that deviates from `hilab-streaming-rules.md` | inline comment + ADR entry in `architecture-overview.md` |

**Diagram format:**
- Formal diagrams (state machines, ERDs, cross-module architecture) → PlantUML (`.puml`) in `diagrams/` — AI writes the `.puml` file only; PNG generation is left to the developer (`make diagrams` in streaming-docs root)
- Inline workflow and sequence diagrams in `features/<task-slug>.md`, `design.md`, or `impact.md` → Mermaid (renders in GitLab/GitHub markdown)

**Hard rule — master ERD:** Any change to a sub-ERD (`diagrams/<NN>-<module>-erd.puml`) **must** update the master ERD (`diagrams/00-database-overview-erd.puml`) in the same commit — even if it's only adding an entity stub and FK arrow. A stale master ERD is worse than none.

**Test:** if a new engineer would ask "why?" for >5 min reading the code → it needs a document.

**Inverse:** simple CRUD, standard NestJS patterns, obvious queries → README update only.

---

## § workflow-links.md — module task history

Each module that has been through a dev workflow task maintains `workflow-links.md`.

**Location:** `streaming-docs/documents/modules/<NN>-<name>/workflow-links.md`

**Template:**

```markdown
# Workflow Links: <module>

| Task | Folder | Started | Status |
|------|--------|---------|--------|
| chat-module-mvp | [workflow/chat-module-mvp/](../../workflow/chat-module-mvp/) | 2026-05-11 | complete |
| chat-reactions | [workflow/chat-reactions/](../../workflow/chat-reactions/) | 2026-05-20 | in-progress |
```

**Lifecycle:**
- Phase 0b (Context Load) creates the row with `status: in-progress`
- `hsd-post-merge` updates it to `status: complete`
- Abandoned tasks: set `status: abandoned`, add reason in a `Notes` column

---

## § Documentation quality standards

- `README.md` always reflects **current implementation**, not original design intent
- All diagrams are PlantUML (`.puml`) — AI writes `.puml` only; developer runs `make diagrams` when images are needed
- Use concrete identifiers: actual GraphQL mutation names, actual queue names, actual Prisma model names
- No `<!-- TODO: document this -->` left unresolved after task PR is merged
