# typescript — Framework Preset

TypeScript language preset — type-safe coding style, idiomatic patterns, testing, security, and a dedicated TS code reviewer. Foundation layer for any TypeScript-based framework preset (NestJS, Next.js, etc.).

## Who should use it

Any developer working in TypeScript / Node.js / JavaScript projects. Composes underneath framework-specific presets so the same TS rules apply across backend and frontend stacks.

## Extends

`developer` → `ai-native` → `core`

## Components

| Type | Name | Description |
|------|------|-------------|
| agent | `typescript-reviewer` | TS-aware code reviewer — type safety, async correctness, security, idiomatic patterns. MUST BE USED for TS/JS changes. |
| rule | `typescript/coding-style` | Naming, formatting, immutability, idiomatic TS conventions |
| rule | `typescript/patterns` | Idiomatic patterns (option types, exhaustive switches, brand types, etc.) |
| rule | `typescript/testing` | Unit + integration test patterns, mocking strategy |
| rule | `typescript/security` | Common pitfalls — input validation, prototype pollution, secret handling |
| rule | `typescript/hooks` | Hook authoring patterns (React hooks, Node lifecycle hooks) |

Inherited from `developer`: `tdd-workflow`, `github-ops`, `prp-plan`, `feature-dev`, `planner`, `code-architect`, `code-explorer`, `code-reviewer` (generic), `code-simplifier`, post-edit-typecheck hook, pre-bash-commit-quality hook, block-no-verify hook.

## Install

```bash
# User-level (recommended — TS rules apply across all your TS projects)
pnpm install:user typescript --force --symlink

# Project-level
pnpm install:project typescript --force --symlink
```

## Composition

Used as a base by:

- `nestjs` — `extends: [developer, typescript]`
- `nextjs` — `extends: [developer, typescript]`

Add it to your own framework preset the same way to inherit the TS-aware reviewer and rules.

## Enable / Disable after install

### Rules

Rules live in `.claude/rules/typescript/`. Claude loads them automatically when working in TS files. Delete a specific rule file (or its symlink) to disable it.

### Agent

`typescript-reviewer` is invoked automatically on TS/JS code changes. To disable, delete `.claude/agents/typescript-reviewer.md` (or its symlink).

### Full uninstall

```bash
pnpm uninstall typescript
```
