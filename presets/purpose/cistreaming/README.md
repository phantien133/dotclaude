# cistreaming

Dev workflow preset for the cistreaming platform (NestJS + Next.js + SRS + GraphQL).
Bundles the `w-*` feature workflow suite, the `f-*` Figma pipeline, streaming-specific
rules, and doc governance into a single canonical preset.

→ **[WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md)** — full command reference, phase flows, free-prompt guide, setup config  
→ **[AGENTS.md](AGENTS.md)** — agent orchestration rules, security guidelines, coding conventions

---

## What this preset provides

**Workflow (`w-*`)** — config-driven via `.claude/workflow.yaml`.

| Component | Description |
|-----------|-------------|
| `/w-task` | Full 8-phase feature workflow (intake → context → plan → impact → UI → TDD → docs → PR) |
| `/w-fix` | Lightweight fix workflow — ≤3 files, <2h, no schema change |
| `/w-setup` `/w-status` `/w-reset` `/w-pr` | Config wizard, state inspection, reset, PR creation |
| `w-document-build-up` | One-time backfill of streaming-docs from existing codebase (run before `/w-setup` on legacy modules) |
| Phase helpers | `w-context-load`, `w-oq-check`, `w-impact-analyzer`, `w-adr`, `w-test-stubs`, `w-feature-record`, `w-api-doc`, `w-db-doc`, `w-doc-gate` — each is a no-op when its field in `workflow.yaml` is unset |

**Figma (`f-*`)** — design-to-code pipeline.

| Component | Description |
|-----------|-------------|
| `/f-setup` | One-time Figma MCP / export path configuration |
| `/f-import` `/f-ui-kit` `/f-page` `/f-review` | Import designs, generate components, review against Figma |

**Rules & governance**

| Component | Description |
|-----------|-------------|
| `streaming-context` | Platform module map, tech stack, active OQs |
| `hilab-streaming-rules` | NestJS conventions, Prisma patterns, BullMQ/Redis guardrails, GraphQL code-first |
| `streaming-docs-governance` | Doc update triggers, companion document requirements, master ERD invariant |
| `hsd-story-lint` | Pre-workflow story file validator |
| `hsd-post-merge` | Legacy doc sync command — kept for in-flight tasks; new tasks use `w-doc-gate` |

**Agents** — `tdd-guide` (explicit, Phase 4). `planner`, `code-explorer`, `code-architect`, `code-reviewer`, `code-simplifier` via the `nestjs` / `nextjs` → `developer` chain. See [AGENTS.md](AGENTS.md).

**Opt-in private fallbacks** — `streaming-oq-check`, `streaming-adr`, `streaming-checkpoint`, `streaming-test-stubs`, `create-pr`.

---

## Dependencies

External tools and MCP servers consumed by this preset. Install before running `/w-setup` or `/f-setup`.

### Required

| Tool | Used by | Install |
|------|---------|---------|
| `glab` CLI | `/w-pr` — creates GitLab MR | `brew install glab` then `glab auth login` |
| Node.js ≥ 18 | All `w-*` skills (tsx scripts) | via `nvm` or system package manager |

### Optional — enhances specific features

| Tool | Used by | Without it | Install |
|------|---------|------------|---------|
| **Figma MCP** (`@figma/mcp`) | `/f-import`, `/f-review` — MCP mode | Falls back to Figma export folder mode | `claude mcp add figma -- npx -y @figma/mcp` |
| **Plane MCP** | `/w-task` — auto-fetch ticket details | Must paste ticket description manually | See [Plane MCP docs](https://developers.plane.so/mcp); set `mcp_available: true` in `workflow.yaml` |
| **mgrep** | Search within Claude Code sessions (replaces built-in `Grep`/`WebSearch`) | Built-in grep is used instead | Install via dotclaude: `pnpm install:project mgrep` |
| `gh` CLI | `/w-task` with `issue_tracker.type: github` | Must paste GitHub issue description manually | `brew install gh` then `gh auth login` |

### Figma MCP — setup detail

```bash
# Add to Claude Code (once per machine)
claude mcp add figma -- npx -y @figma/mcp

# Verify it appears
claude mcp list
# → figma   npx -y @figma/mcp

# Then run the f-* wizard to store the result in .claude/figma.yaml
/f-setup
```

`/f-import <figma-url>` will use MCP automatically when `mcp_available: true` is set in `.claude/figma.yaml`. Without MCP, use `/f-import --export <folder>` with a Figma export directory instead.

### Plane MCP — setup detail

```bash
# Follow Plane's MCP installation guide, then add to Claude Code:
claude mcp add plane -- <plane-mcp-command>

# In .claude/workflow.yaml, set:
issue_tracker:
  type: plane
  mcp_available: true   # ← enables auto-fetch in /w-task and /w-fix
```

When `mcp_available: false`, `/w-task <CISTREAMIN-42>` will ask you to paste the ticket description instead of fetching it automatically.

### mgrep — setup detail

`mgrep` is a Claude Code skill that replaces the built-in `Grep` and `WebSearch` tools with a unified, context-aware search interface. The `mgrep:mgrep` skill is listed in this session's available skills and is invoked automatically by Claude Code when searching.

```bash
# Install into the current project (adds to .claude/skills/)
pnpm install:project mgrep

# Or install for all projects (user-level)
pnpm install:user mgrep
```

---

## Setup

```bash
# 1. Legacy projects only — skip if streaming-docs already exist
/w-document-build-up streaming-docs/documents

# 2. Configure workflow paths and issue tracker
/w-setup

# 3. Configure Figma (optional)
/f-setup
```

See [WORKFLOW_GUIDE.md § Setup Reference](WORKFLOW_GUIDE.md#setup-reference) for the full `.claude/workflow.yaml` field reference.

---

## Extends

- `nestjs` — NestJS patterns, Prisma, API design, security review
- `nextjs` — Next.js patterns, frontend architecture

Both extend the `developer` chain, providing `planner`, `code-explorer`, `code-architect`, `code-reviewer`, `code-simplifier` transitively.

---

## Source

Team plugin: `ssh://git@gitlab.hilab.cloud:2424/hilabaikit/dotclaude.git`
