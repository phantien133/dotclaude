# cistreaming-v2

Dev workflow preset for the cistreaming platform v2 (NestJS + Next.js + SRS + GraphQL).

## What this preset provides

- **8-phase workflow** via `/dev-task` — intake (Plane ticket or free title) → context → plan → impact → UI → TDD → verify → PR
- **Streaming-specific rules** — NestJS module conventions, Prisma patterns, error handling, BullMQ, Redis guardrails
- **Doc governance** — enforces that `streaming-docs` stays in sync with implementation
- **Figma integration** — decision tree for Make / Dev Mode / MCP export paths
- **Utility skills** — OQ surface, ADR writer, git checkpoints, test stub generator
- **Curated agents** — planner (Phase 1), tdd-guide (Phase 4), code-reviewer (after GREEN)
- **Commands** — `hsd-story-lint` (pre-workflow story validator), `hsd-post-merge` (post-merge doc runner)

## Usage

```bash
# Start from a Plane ticket URL
/dev-task https://pm.hilab.cloud/hilab/browse/CISTREAMIN-11/

# Start from a free task title
/dev-task "add chat read receipts"

# Advance to the next phase (after each gate)
/dev-task continue

# Check status without advancing
/dev-task-status

# Validate a story file before starting
/hsd-story-lint stories/chat-mvp.md

# After MR is merged
/hsd-post-merge chat-module-mvp
```

## Extends

- `nestjs` — NestJS patterns, Prisma, API design, security review, verification
- `nextjs` — Next.js patterns, frontend architecture

## Source

Team plugin: `ssh://git@gitlab.hilab.cloud:2424/hilabaikit/claudekit.git` (packages/cistreaming)
