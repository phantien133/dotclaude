---
description: Write a new ADR entry to streaming-docs/documents/overview/architecture-overview.md when a Phase 2 impact analysis reveals an architecture decision.
argument-hint: <adr-title>
allowed-tools: Read, Write, Edit, Bash
---

# streaming-adr

Write a timestamped ADR entry for `$ARGUMENTS` to `streaming-docs/documents/overview/architecture-overview.md`.

## When to use

Call this skill during Phase 2 (Impact & Design) when the analysis uncovers:
- A choice between two non-obvious approaches where the reasoning should be preserved
- A decision that affects other modules or team conventions going forward
- A deviation from patterns in `hilab-streaming-rules.md`

Not every implementation choice needs an ADR. Simple CRUD, standard patterns, and obvious queries do not.

## Steps

1. Read `streaming-docs/documents/overview/architecture-overview.md` — find the existing ADR list and determine the next ADR number
2. Draft ADR entry:

```markdown
### ADR-NNN: <title>

**Date:** YYYY-MM-DD  
**Status:** Accepted  
**Context:** <why this decision was needed — what problem it solves>  
**Decision:** <what was decided>  
**Consequences:** <trade-offs and implications>  
**Alternatives considered:** <what was rejected and why>
```

3. Append the entry to the ADR section in `architecture-overview.md`
4. Add a reference in `impact.md` under "Architecture Decisions" section

## Output

Confirm: "ADR-NNN written to architecture-overview.md."
