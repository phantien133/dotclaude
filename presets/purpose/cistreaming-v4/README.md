# cistreaming-v4

Dev workflow preset for the cistreaming platform v4 (NestJS + Next.js + SRS + GraphQL).
Successor to `cistreaming-v3`: replaces the private `dev-task` / `quick-fix` orchestration
with the public `w-*` command suite, while keeping the v3 Figma `f-*` UI flow and streaming
rules.

## What's new vs v3

- **`w-*` workflow suite** replaces v3's `dev-task` / `quick-fix` / `dev-task-status` /
  `dev-task-reset`:
  - `/w-setup` — one-time wizard that writes `.claude/workflow.yaml` (issue tracker,
    state root, PR config, etc.)
  - `/w-task` — full feature workflow (intake → context → plan → impact → UI → TDD → docs → PR)
  - `/w-fix` — lightweight fix workflow (intake → fix → commit + docs → PR) for changes
    affecting 1–3 files, <2h, no schema / API surface
  - `/w-status` — show state for one task or all tasks without advancing
  - `/w-reset` — reset a task back to phase 0 or wipe the task folder entirely
  - `/w-pr` — create a PR for the current branch using `gh`, reading `pr.*` config

  → All `w-*` skills read `.claude/workflow.yaml` (vs v3's hard-coded streaming-docs paths).
  This makes the workflow portable across other Hilab projects without touching the skill files.

## What this preset provides

- **Generic w-* workflow** — same 8-phase flow as v3 (`/w-task`) and lightweight fix flow
  (`/w-fix`), driven by per-project config in `.claude/workflow.yaml`
- **Streaming-specific rules** — NestJS module conventions, Prisma patterns, error handling,
  BullMQ / Redis guardrails, doc governance (carried from v2/v3)
- **Figma f-* suite** — `/f-setup`, `/f-import`, `f-ui-kit`, `f-page`, `f-review`
  (identical to v3)
- **Streaming utility skills** — `streaming-oq-check`, `streaming-adr`, `streaming-checkpoint`,
  `streaming-test-stubs` (opt-in helpers callable inside any phase)
- **Doc governance commands** — `/hsd-story-lint` (pre-workflow story validator),
  `/hsd-post-merge` (post-merge doc runner)
- **Curated agents** — `tdd-guide` (TDD phase). `planner` + `code-reviewer` come from the
  developer chain via `nestjs` / `nextjs` extends.

## Usage

```bash
# One-time per project
/w-setup

# Feature workflow
/w-task https://pm.hilab.cloud/hilab/browse/CISTREAMIN-11/   # start from a Plane ticket
/w-task "add chat read receipts"                              # or a free task title
/w-task continue                                              # advance to the next phase

# Status / reset
/w-status                                                     # all tasks
/w-status <task-slug>                                         # specific task
/w-reset <task-slug>                                          # reset to phase 0
/w-reset <task-slug> --wipe                                   # wipe folder

# Lightweight fix flow
/w-fix #123                                                   # from an issue number
/w-fix "viewer count stale after reconnect"                   # or a free description

# PR creation
/w-pr <task-slug>                                             # uses plan.md as body

# Story / doc helpers
/hsd-story-lint stories/chat-mvp.md                           # pre-workflow story check
/hsd-post-merge chat-module-mvp                               # post-merge doc updates

# Figma workflow (one-time setup, then per-module)
/f-setup                                                      # writes .claude/figma.yaml
/f-import auth:https://figma.com/design/...                   # MCP mode, "auth" scope
/f-import auth:--export src/exports/auth                      # export-folder mode
/f-review auth                                                # diff Figma vs installed
```

## When to choose v4 over v3

- You want the **same workflow** but configured per-project in YAML (portable beyond the
  streaming repo).
- You prefer the shorter `w-*` command surface (`/w-task` vs `/dev-task`).
- You want the workflow skills to live in the public `claudekit/skills/` tree (versionable,
  installable as a plugin) rather than `claudekit/private/skills/`.

Choose **v3** if you want the original `/dev-task` invocation and the hard-coded
`streaming-docs/workflow/` state paths.

## Extends

- `nestjs` — NestJS patterns, Prisma, API design, security review, verification
- `nextjs` — Next.js patterns, frontend architecture

(Both transitively bring in `developer` → `core`, so the full developer chain — planner,
code-reviewer, tdd-workflow, simplify, security-review, verification-loop — is included
without re-declaration.)

## Install

```bash
pnpm install:project cistreaming-v4 --force          # copy mode, overwrite without .bak
# or
pnpm install:project cistreaming-v4 --force --symlink # symlink mode for in-place edits
```
