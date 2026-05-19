# developer

Extends `ai-native` with cross-stack developer tooling — GitHub ops, quality gates, and
architecture planning. Security and TDD are **intentionally omitted** — add them in a
language/framework preset that inherits from this one.

**Inherits all components from [`ai-native`](../ai-native/README.md) → [`core`](../core/README.md).**

## Who should use this

Any software developer using Claude Code — regardless of stack. Use as a base for
more specific presets (e.g., `typescript-next`, `go-backend`).

## Components (additional to ai-native)

| Type | Name | Purpose |
|------|------|---------|
| skill | `tdd-workflow` | TDD guidance (JS/TS-specific — override in non-JS framework presets) |
| skill | `github-ops` | PR/issue management, CI status, releases via `gh` CLI |
| command | `prp-plan` | Generate implementation plan with codebase analysis |
| command | `feature-dev` | Guided feature development with architecture focus |
| agent | `planner` | Planning agent for complex features and refactoring |
| agent | `code-architect` | Architecture design: files, interfaces, data flow, build order |
| hook | `post-edit-typecheck` | TypeScript check after editing `.ts`/`.tsx` files |
| hook | `pre-bash-commit-quality` | Quality gate before git commit |
| hook | `block-no-verify` | Blocks `--no-verify` flag to prevent bypassing hooks |

## What framework presets inheriting this should add

`developer` intentionally leaves security review and TDD to language/framework-specific presets.
When building a preset that `extends: [developer]`, add the appropriate tools for your stack:

| Concern | Example for TypeScript/Node | Example for Python | Example for Go |
|---------|----------------------------|--------------------|----------------|
| Security skill | `security-review` (ECC) | language-specific alternative | language-specific alternative |
| Security agent | `security-reviewer` (npm audit) | equivalent for pip/bandit | equivalent for go vet |
| Security cross-lang | `security-bounty-hunter` (semgrep) | `security-bounty-hunter` | `security-bounty-hunter` |
| TDD guidance | `tdd-workflow` (already inherited) | replace with python-testing equivalent | replace with golang-testing equivalent |
| TDD enforcement | `tdd-guard` (system_binary hook) | `tdd-guard` | `tdd-guard` |

See sidecar `SOURCE.yaml` / `<name>.source.yaml` for each component — they contain `notes`
with specific alternative suggestions and `tags: [framework-preset-candidate]` where relevant.

## Hook wiring

Add to `~/.claude/settings.json` (user-level install):

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

> **Note:** Merge this with hook wiring from `core` (inherited) — do not replace the
> existing `hooks` block, add new event entries alongside it.

## Enable / Disable after install

### Hooks

| Hook | Event | Disable by removing |
|------|-------|---------------------|
| `post-edit-typecheck` | PostToolUse/"Edit" | the `post-edit-typecheck` entry under `hooks.PostToolUse` |
| `pre-bash-commit-quality` | PreToolUse/"Bash" | the `pre-bash-commit-quality` entry under `hooks.PreToolUse` |
| `block-no-verify` | PreToolUse/"Bash" | the `block-no-verify` entry under `hooks.PreToolUse` |

To **disable quality gates temporarily** (e.g., emergency fix):
- Remove `pre-bash-commit-quality` and `block-no-verify` entries from `settings.json`
- Re-add after the emergency is resolved

To **disable typecheck on edit** (e.g., large refactor in progress):
- Remove the `post-edit-typecheck` entry under `hooks.PostToolUse`

### Full uninstall

```bash
pnpm uninstall developer
```

## Install

```bash
# User level (recommended — applies to all projects):
pnpm install:user developer --force --symlink

# Project level (this project only):
pnpm install:project developer --force --symlink
```
