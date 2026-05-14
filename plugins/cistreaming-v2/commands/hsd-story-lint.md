---
description: Validate a story file before starting the dev-task workflow — checks for required sections and flags missing content.
---

# hsd-story-lint

Validate the story file at `$ARGUMENTS` (path to story file) before starting the workflow.

## Steps

1. Read the story file at the provided path
2. Check for required sections:

| Check | Required | Pass condition |
|-------|----------|----------------|
| Title | Yes | File has a `# <title>` header |
| Module | Yes | Mentions which module this belongs to |
| Acceptance criteria | Yes | Has at least one explicit acceptance criterion |
| Edge cases | Yes | Has at least one edge case described |
| Out of scope | Recommended | Explicitly states what is not in scope |
| Dependencies | Recommended | Notes if blocked by another task or OQ |

3. Check for OQ conflicts:
   - Read `streaming-docs/documents/overview/open-questions.md`
   - If story touches a module with BLOCKING OQs → flag as WARNING

4. Output results:

```
Story Lint: <story-file>

PASS  Title: "Chat Module MVP"
PASS  Module: chat
PASS  Acceptance criteria: 3 found
FAIL  Edge cases: none found
WARN  Missing "Out of scope" section
WARN  OQ-008 (Chat Storage Strategy) is open and may affect this feature

Result: FAIL — fix 1 error before starting workflow
```

5. If all checks pass: say "Story is valid. Run `/dev-task <task-title> chat <story-file>` to start."

## Usage

Run before starting any workflow task. The `dev-task` Phase 1 will be stronger if the story is clean.
