# Dotclaude Self — Agent Instructions

Full dotclaude working environment — preset authoring wizards, self-learning, component picker, and skill creator.

**Version:** 0.2.0

## Core Principles

1. **Wizard-first** — use `/preset-wizard` before authoring presets manually; use skills for component work
2. **Plan before execute** — use planner for multi-file changes; always update docs/plan/ for complex tasks
3. **Agent-first** — delegate domain tasks to specialized agents proactively
4. **Schema-first** — changing data shape means editing zod schema first, regenerating JSON Schema, then updating consumers
5. **Sidecar sync** — editing a component in claudekit/ requires setting `modified: true` and updating `modifications:`

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| planner | Expert planning specialist for complex features and refactoring | Multi-step preset authoring, installer changes |
| code-architect | Designs feature architectures with blueprints and build order | New script modules, schema changes |
| code-explorer | Traces execution paths and maps architecture layers | Understanding installer or build script flow |
| code-reviewer | Expert code review for quality, security, and maintainability | After writing or modifying any code |
| code-simplifier | Simplifies and refines code for clarity | After implementing a feature, before PR |

## Agent Orchestration

Use agents **proactively without waiting for the user to ask**:

- Complex preset authoring or multi-file installer changes → **planner**
- Code just written or modified → **code-reviewer**
- Schema or architectural changes → **code-architect**
- Understanding existing installer logic → **code-explorer**

Use parallel execution for independent sub-tasks.

## Security Guidelines

**Before ANY commit:**
- No hardcoded secrets (API keys, passwords, tokens)
- All user inputs validated at system boundaries
- No arbitrary TypeScript casts — strict types throughout
- Error messages do not leak sensitive data

**If a security issue is found:** STOP → invoke code-reviewer → fix CRITICAL issues.

## Coding Style

- **dotclaude-component-picker**: Full 8-step pipeline from upstream browse → vendor → sidecar → preset → verify
- **preset-debugger**: Diagnoses and fixes broken presets or plugin build failures
- **plugin-discovery**: Searches GitHub for external components to vendor into claudekit
- `/preset-wizard`: Interactive wizard to create a new dotclaude preset from scratch
- `/dotclaude-setup`: Wizard to bootstrap a new Claude Code install from dotclaude
- Strict TypeScript: `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` — handle `undefined` explicitly
- Never import `js-yaml` directly — use `lib/yaml.ts` with `CORE_SCHEMA`
