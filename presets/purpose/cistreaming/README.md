# cistreaming

Dev workflow preset for the cistreaming platform (NestJS + Next.js + SRS + GraphQL).
Successor to `cistreaming-v2`/`v3`/`v4`: consolidates the v2 streaming foundation, the
v3 Figma `f-*` UI flow, and the v4 public `w-*` workflow suite into a single canonical
preset.

## What this preset provides

- **`w-*` workflow** — feature workflow (`/w-task`), quick fix (`/w-fix`), config wizard
  (`/w-setup`), status (`/w-status`), reset (`/w-reset`), PR (`/w-pr`). Config-driven via
  `.claude/workflow.yaml`. Replaces v2/v3's private `dev-task` / `quick-fix` /
  `dev-task-status` / `dev-task-reset`.
- **`w-document-build-up`** — one-time skill to backfill streaming-docs-style docs from an
  existing codebase. Run BEFORE `/w-setup` on legacy modules.
- **`w-*` helpers** — Phase-aware skills invoked by `w-task`:
  `w-context-load`, `w-oq-check`, `w-impact-analyzer`, `w-adr`, `w-test-stubs`,
  `w-feature-record`, `w-api-doc`, `w-db-doc`, `w-doc-gate`. Each is a no-op when its
  field in `workflow.yaml` is unset — opt in incrementally.
- **Figma `f-*` suite** — `/f-setup`, `f-import`, `f-ui-kit`, `f-page`, `f-review`.
  Replaces v2's `build-ui-kit` + `build-static-page` + `streaming-figma`.
- **Streaming-specific rules** — NestJS module conventions, Prisma patterns, error
  handling, BullMQ + Redis guardrails, GraphQL code-first conventions.
- **Doc governance** — `streaming-docs-governance` rule + `hsd-story-lint` (pre-workflow
  story validator) + `hsd-post-merge` (kept for in-flight legacy tasks; new tasks rely on
  `w-doc-gate` pre-PR invariant).
- **Curated agents** — `tdd-guide` (Phase 4 of `w-task`). `code-explorer`, `code-architect`,
  `code-reviewer`, `planner`, `code-simplifier` come transitively from the developer chain
  via `nestjs` / `nextjs`.
- **Opt-in private fallbacks** — `streaming-oq-check`, `streaming-adr`,
  `streaming-checkpoint`, `streaming-test-stubs`, `create-pr` (PR backend for `/w-pr`).

## First-time setup

```bash
# 1) (Legacy projects only — skip if docs already exist) backfill docs from source
/w-document-build-up streaming-docs/documents

# 2) Configure paths consumed by w-* skills (issue tracker, doc roots, schema paths)
/w-setup

# 3) (Optional) Configure Figma MCP / export paths
/f-setup
```

## Daily usage

```bash
# Feature workflow — full 8-phase (intake → context → plan → impact → UI → TDD → docs → PR)
/w-task https://pm.hilab.cloud/hilab/browse/CISTREAMIN-11/
/w-task "add chat read receipts"
/w-task                                # advance to next phase after each gate

# Quick fix (≤3 files, <2h, no schema change)
/w-fix "fix typo in stream-key error message"

# Status / state
/w-status
/w-reset <task-slug>                   # reset task back to phase 0

# Pre-workflow story file validator
/hsd-story-lint stories/chat-mvp.md

# PR creation (runs w-doc-gate first to enforce docs-with-code invariant)
/w-pr <task-slug>

# Figma → code
/f-import <figma-url>
/f-ui-kit <module>
/f-page <module>
/f-review <module>
```

## Doc invariant

Docs ship with code in the same PR — `w-task` Phase 5 commits doc updates in the same
branch as code; `w-doc-gate` runs at `/w-pr` time and BLOCKS creation if a module touched
in CODE lacks corresponding DOC changes. The master ERD invariant (any sub-ERD change
MUST be accompanied by a master ERD update in the same branch) is enforced as the
strictest check. Replaces the post-merge `hsd-post-merge` drift-recovery flow.

## Extends

- `nestjs` — NestJS patterns, Prisma, API design, security review, verification
- `nextjs` — Next.js patterns, frontend architecture

Both extend the `developer` chain, which provides `code-explorer`, `code-architect`,
`code-reviewer`, `code-simplifier`, `planner` agents transitively.

## Migration from v2 / v3 / v4

| v2 / v3 / v4 component | Replacement |
|---|---|
| `dev-task` / `quick-fix` / `dev-task-status` / `dev-task-reset` | `w-task` / `w-fix` / `w-status` / `w-reset` (+ `/w-setup` wizard) |
| `build-ui-kit` / `build-static-page` / `streaming-figma` | `f-ui-kit` / `f-page` / `f-import` / `f-review` (+ `/f-setup`) |
| `hsd-post-merge` | `w-doc-gate` (pre-PR invariant — kept as legacy command) |
| (none) | `w-document-build-up` for legacy doc backfill |

Run `/w-setup` after upgrading to define the doc paths (`module_docs_root`,
`db_docs_root`, `master_erd_path`, etc.) that the new helpers consume.

## Source

Team plugin: `ssh://git@gitlab.hilab.cloud:2424/hilabaikit/dotclaude.git`
