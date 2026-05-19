# nestjs — Framework Preset

NestJS backend preset for production-grade TypeScript APIs with modular architecture, DTO validation, database integration, and quality gates.

## Who should use it

Backend or full-stack developers building NestJS REST APIs, microservices, or monorepo backends with TypeScript.

## Extends

`developer` + `typescript` → `ai-native` → `core`

## Components

| Type | Name | Description |
|------|------|-------------|
| skill | `nestjs-patterns` | Modules, controllers, providers, DTO validation, guards, interceptors |
| skill | `backend-patterns` | REST error handling, response shaping, generic backend patterns |
| skill | `api-design` | API contract design and OpenAPI/Swagger documentation |
| skill | `database-migrations` | TypeORM / Prisma migration patterns |
| skill | `postgres-patterns` | PostgreSQL query patterns and optimization |
| skill | `verification-loop` | Quality gate — run after implementing a feature or before PR |

Inherited from `developer`: `tdd-workflow`, `github-ops`, `prp-plan`, `feature-dev`, `planner`, `code-architect`, `code-explorer`, `code-reviewer` (generic), `code-simplifier`, post-edit-typecheck hook, pre-bash-commit-quality hook, block-no-verify hook.

Inherited from `typescript`: `typescript-reviewer` agent, `typescript/coding-style`, `typescript/patterns`, `typescript/testing`, `typescript/security`, `typescript/hooks` rules.

## Install

```bash
# Project-level (recommended — backend-specific)
pnpm install:project nestjs --force --symlink

# User-level (if NestJS is your primary stack)
pnpm install:user nestjs --force --symlink
```

## Hook wiring

After installing, add these entries to `~/.claude/settings.json` (user-level install):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/post-edit-typecheck.js" }]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node ~/.claude/hooks/pre-bash-commit-quality.js" },
          { "type": "command", "command": "node ~/.claude/hooks/block-no-verify.js" }
        ]
      }
    ]
  }
}
```

For **project-level** install, replace `~/.claude/hooks/` with `.claude/hooks/`.

> **Note:** Also wire hooks from `core` (inherited) — merge, do not replace the existing `hooks` block.
> See [core hook wiring](../core/README.md#hook-event-wiring).

## Enable / Disable after install

### Skills

Skills are passive — invoked by Claude on demand or via `/skill-name`. To disable a skill, remove its symlink from `.claude/skills/` in the target directory.

### Hooks (inherited from developer)

| Hook | Event | Disable by removing |
|------|-------|-------------------|
| `post-edit-typecheck` | PostToolUse (Edit) | the `post-edit-typecheck` entry under `hooks.PostToolUse` in `settings.json` |
| `pre-bash-commit-quality` | PreToolUse (Bash) | the `pre-bash-commit-quality` entry under `hooks.PreToolUse` |
| `block-no-verify` | PreToolUse (Bash) | the `block-no-verify` entry under `hooks.PreToolUse` |

### Full uninstall

```bash
pnpm uninstall nestjs
```
