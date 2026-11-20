# rails-api — Framework Preset

Ruby on Rails **API-only** preset: 37signals-style Rails conventions, RSpec test design, safe
PostgreSQL migrations, security review, background jobs, and webhooks.

## Who should use it

Backend developers building JSON APIs with `rails new --api`, PostgreSQL, RSpec + FactoryBot.

## Extends

`developer` → `ai-native` → `core`

## Components

| Type | Name | Source | Description |
|------|------|--------|-------------|
| skill | `rails-best-practices-core` | 37signals-skills | Core Rails architecture, naming, safety, maintainability |
| skill | `rails-migrations` | 37signals-skills | Reversible, lock-aware migrations and rollout sequencing |
| skill | `rails-security-multitenancy` | 37signals-skills | Scoped queries, auth, SSRF, CSRF, rate limiting, tenant boundaries |
| skill | `rails-jobs` | 37signals-skills | Active Job orchestration, idempotency, safe retries |
| skill | `rails-webhooks` | 37signals-skills | Inbound/outbound webhooks, retries, observability |
| skill | `dhh` | 37signals-skills | `/dhh` — opinionated DHH-style review of a diff or file |
| skill | `rails-testing` | pproenca-skills | RSpec best practices — 46 rules: request specs, FactoryBot, jobs, perf |
| skill | `postgres-patterns` | everything-claude-code | PostgreSQL query, index, and schema patterns |
| skill | `database-migrations` | everything-claude-code | Zero-downtime migration strategies (cross-ORM) |
| skill | `api-design` | everything-claude-code | REST contract design, versioning, error shapes |
| skill | `backend-patterns` | everything-claude-code | Service layer, error handling, response shaping |
| skill | `security-bounty-hunter` | everything-claude-code | Semgrep-based security hunt (supports Ruby) |
| skill | `verification-loop` | everything-claude-code | Quality gate before marking work done / opening a PR |
| agent | `database-reviewer` | everything-claude-code | PostgreSQL schema/query/migration review |
| agent | `tdd-guide` | everything-claude-code | Test-first workflow guide (examples are JS — apply with RSpec) |

**Inherited from `developer`:** `tdd-workflow` (⚠ JS-only — Jest/Vitest; prefer `rails-testing`
for Ruby), `github-ops`, `prp-plan`, `feature-dev`, `planner`, `code-architect`,
`code-explorer`, `code-reviewer`, `code-simplifier`.

**Inherited from `ai-native` / `core`:** `continuous-learning-v2`, `skill-creator`,
`ai-regression-testing`, `doc-coauthoring`, `setup-dotclaude-preset-hooks`, mgrep plugin.

### Notes on 37signals skills

- All except `rails-best-practices-core` keep upstream `disable-model-invocation: true` —
  invoke them explicitly (`/rails-migrations`, `/rails-security-multitenancy`, `/rails-jobs`,
  `/rails-webhooks`, `/dhh`). Claude will not auto-load them.
- Unofficial, not affiliated with 37signals. Skill text is MIT; embedded code examples from
  Fizzy are under the [O'Saasy License](https://osaasy.dev).
- `rails-testing` (Minitest) and `rails-hotwire-realtime` from 37signals are intentionally
  excluded — this preset is RSpec + API-only.

## Hooks

This preset adds no hooks of its own. Inherited hooks:

| Hook | Event | Matcher | Recommended | What it does |
|------|-------|---------|-------------|--------------|
| `suggest-compact` | `PreToolUse` | `"Edit\|Write"` | ✓ Enable | Suggests compaction near context limit |
| `doc-file-warning` | `PreToolUse` | `"Write"` | Optional | Warns before writing doc files |
| `pre-compact` | `PreCompact` | `"*"` | ✓ Enable | Saves session state before compaction |
| `desktop-notify` | `Stop` | `"*"` | ✓ Enable | Desktop notification when Claude stops |
| `cost-tracker` | `Stop` | `"*"` | ✓ Enable | Logs session cost |
| `pre-bash-commit-quality` | `PreToolUse` | `"Bash"` | ✓ Enable | Conventional-commit check (does not lint `.rb`) |
| `block-no-verify` | `PreToolUse` | `"Bash"` | ✓ Enable | Blocks `git commit --no-verify` |
| `post-edit-typecheck` | `PostToolUse` | `"Edit"` | ⚠ Consider disabling | TypeScript-only; no-op on Ruby files |

## Recommended settings_patch (enabled hooks only)

Inherited `settings_patch` is merged automatically. For a project-level install the
equivalent paths are:

```yaml
settings_patch:
  hooks:
    PreToolUse:
      - matcher: "Bash"
        hooks:
          - type: command
            command: "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/pre-bash-commit-quality.js"
            # user-level: node ~/.claude/hooks/pre-bash-commit-quality.js
          - type: command
            command: "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/block-no-verify.js"
            # user-level: node ~/.claude/hooks/block-no-verify.js
    PreCompact:
      - matcher: "*"
        hooks:
          - type: command
            command: "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/pre-compact.js"
    Stop:
      - matcher: "*"
        hooks:
          - type: command
            command: "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/desktop-notify.js"
          - type: command
            command: "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/cost-tracker.js"
```

## External tools (not enabled by default)

| Tool | Kind | Setup | Notes |
|------|------|-------|-------|
| [postgres-mcp](https://github.com/crystaldba/postgres-mcp) | mcp_server | `claude mcp add postgres --env DATABASE_URI=postgresql://<readonly_user>:<pass>@localhost:5432/<db_development> -- uvx postgres-mcp --access-mode=restricted` | ⚠ Complex — needs `DATABASE_URI`. Use a read-only role on the dev DB. |
| [playwright-mcp](https://github.com/microsoft/playwright-mcp) | mcp_server | `claude mcp add playwright -- npx -y @playwright/mcp@latest` | Low value for API-only apps |

## Enable / Disable after install

### Hooks

| Hook | Event | To disable: remove from `.claude/settings.json` |
|------|-------|----------------------------------------|
| `post-edit-typecheck` | PostToolUse (Edit) | entry under `hooks.PostToolUse[matcher="Edit"]` |
| `pre-bash-commit-quality` | PreToolUse (Bash) | entry under `hooks.PreToolUse[matcher="Bash"]` |
| `block-no-verify` | PreToolUse (Bash) | entry under `hooks.PreToolUse[matcher="Bash"]` |
| `desktop-notify` / `cost-tracker` | Stop | entries under `hooks.Stop` |

Or run `/setup-dotclaude-preset-hooks` for interactive wiring.

### Plugins / MCP servers

| Tool | How to disable |
|------|---------------|
| `mgrep` | Remove `"mgrep@Mixedbread-Grep": true` from `enabledPlugins` |
| `postgres` / `playwright` MCP | `claude mcp remove postgres` / `claude mcp remove playwright` |

## Install

```bash
# Project-level (recommended)
pnpm install:project rails-api --force --symlink

# Uninstall
pnpm uninstall:project rails-api
```
