# cistreaming-v3

Dev workflow preset for the cistreaming platform v3 (NestJS + Next.js + SRS + GraphQL).
Successor to `cistreaming-v2`: replaces the legacy `build-ui-kit` / `build-static-page` /
`streaming-figma` UI flow with the new `f-*` Figma suite, while keeping the v2 8-phase
workflow + private streaming utilities intact.

## What's new vs v2

- **Figma f-* suite** replaces v2's `build-ui-kit` + `build-static-page` + `streaming-figma`:
  - `/f-setup` — one-time wizard that writes `.claude/figma.yaml` (MCP config, output paths, framework detection)
  - `f-import` — orchestrator: MCP URL / export folder / hybrid → manifest → invokes f-ui-kit + f-page
  - `f-ui-kit` — integrate shared components, layout, playground from manifest
  - `f-page` — integrate page components, substitute UI kit components for inline ad-hoc ones
  - `f-review` — diff Figma current vs installed components, selective updates

  → Rebuild plan + walkthrough live in `upstream/dotclaude/figma/docs/` (read those for the v1
  architecture spec, /f-full step-by-step, and Figma plugin research).

## What this preset provides

- **8-phase workflow** via `/dev-task` — intake (Plane ticket or free title) → context → plan → impact → UI → TDD → verify → PR
- **Streaming-specific rules** — NestJS module conventions, Prisma patterns, error handling, BullMQ, Redis guardrails
- **Doc governance** — enforces that `streaming-docs` stays in sync with implementation
- **Figma integration** — `f-*` suite (see above)
- **Utility skills** — OQ surface, ADR writer, git checkpoints, test stub generator
- **Curated agents** — `tdd-guide` (Phase 4). `planner` + `code-reviewer` come from the developer chain via `nestjs`/`nextjs` extends.
- **Commands** — `hsd-story-lint` (pre-workflow story validator), `hsd-post-merge` (post-merge doc runner), `/f-setup`

## Usage

```bash
# Start from a Plane ticket URL
/dev-task https://pm.hilab.cloud/hilab/browse/CISTREAMIN-11/

# Or from a free task title
/dev-task "add chat read receipts"

# Advance to the next phase (after each gate)
/dev-task continue

# Status without advancing
/dev-task-status

# Validate a story before starting
/hsd-story-lint stories/chat-mvp.md

# After MR is merged
/hsd-post-merge chat-module-mvp

# Figma workflow (one-time setup, then per-module import/review)
/f-setup                                    # writes .claude/figma.yaml
/f-import auth:https://figma.com/design/... # MCP mode, scoped to "auth" module
/f-import auth:--export src/exports/auth    # export-folder mode
/f-review auth                              # diff current Figma vs installed
```

## Extends

- `nestjs` — NestJS patterns, Prisma, API design, security review, verification
- `nextjs` — Next.js patterns, frontend architecture

(Both transitively bring in `developer` → `core`, so the full developer chain — planner,
code-reviewer, tdd-workflow, simplify, security-review, verification-loop — is included
without re-declaration.)

## Install

```bash
pnpm install:project cistreaming-v3 --force          # copy mode, overwrite without .bak
# or
pnpm install:project cistreaming-v3 --force --symlink # symlink mode for in-place edits
```
