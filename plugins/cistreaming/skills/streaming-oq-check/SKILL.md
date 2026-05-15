---
description: Surface Open Questions from streaming-docs that are relevant to a given module, for use in Phase 0/1 of dev-task workflow.
argument-hint: <module-name>
allowed-tools: Read, Bash
---

# streaming-oq-check

Surface Open Questions relevant to `$ARGUMENTS` (the module being worked on).

## Steps

1. Read `streaming-docs/documents/overview/open-questions.md`
2. Filter entries that mention `$ARGUMENTS` (module name) or are in BLOCKING or DESIGN-AFFECTING status that could affect the feature
3. Output a filtered list in this format:

```
## Open Questions relevant to <module>

| ID | Title | Status | Impact |
|----|-------|--------|--------|
| OQ-008 | Chat Storage Strategy | Open | Design-affecting — resolve before schema design |
| OQ-003 | Anonymous Viewer Support | Open | Affects Chat auth requirements |
```

4. If no OQs match: output `No blocking or design-affecting OQs for <module>.`

## Usage in workflow

Called by Phase 0 of `/dev-task`. Output is appended to `questions.md § Known constraints`.

The developer must decide whether to proceed (accepting OQ uncertainty) or pause to resolve the OQ before continuing to Phase 1.

## Important

Do NOT suggest resolving OQs unilaterally. Always surface them and wait for developer decision. OQs are resolved through team discussion, not by Claude inferring a solution.
