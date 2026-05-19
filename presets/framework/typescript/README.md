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

## Hook wiring (inherited)

`typescript` adds no new hooks — all hooks come from the `developer` → `ai-native` → `core` chain.
After installing, wire all three layers in your `~/.claude/settings.json`:

1. **[core](../core/README.md#hook-event-wiring)** — `suggest-compact`, `pre-compact`, `desktop-notify`, `cost-tracker`, `doc-file-warning`
2. **[ai-native](../ai-native/README.md#hook-wiring-opt-in)** — `continuous-learning-v2` observer (opt-in)
3. **[developer](../developer/README.md#hook-wiring)** — `post-edit-typecheck`, `pre-bash-commit-quality`, `block-no-verify`

For **project-level** install, replace `~/.claude/hooks/` with `.claude/hooks/` in each snippet.

> Framework presets that build on `typescript` (`nextjs`, `nestjs`) include their own combined wiring guide.

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
