# Developer — Agent Instructions

Extends ai-native with cross-stack developer tooling — GitHub ops, quality gates, and architecture planning.

**Version:** 0.1.0

## Core Principles

1. **Plan before execute** — use planner for any feature with more than 3 files changed
2. **Agent-first** — delegate domain tasks to specialized agents proactively
3. **Review always** — code-reviewer runs after every code change, not just on request
4. **Quality gates** — pre-commit hooks enforce conventional commits and catch common issues
5. **Test-driven** — write tests before implementation

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| planner | Expert planning specialist for complex features and refactoring | Complex features, architectural changes, refactoring |
| code-architect | Designs feature architectures with blueprints and build order | New module structure, architectural decisions |
| code-explorer | Traces execution paths and maps architecture layers | Understanding unfamiliar code before modifying |
| code-reviewer | Expert code review for quality, security, and maintainability | After writing or modifying any code |
| code-simplifier | Simplifies and refines code for clarity while preserving behavior | After implementing a feature, before PR |

## Agent Orchestration

Use agents **proactively without waiting for the user to ask**:

- Complex feature requests (>3 files) → **planner**
- Code just written or modified → **code-reviewer**
- Architectural decisions or new module structure → **code-architect**
- Understanding existing code before changes → **code-explorer**
- Post-implementation cleanup → **code-simplifier**

Use parallel execution for independent sub-tasks — launch multiple agents simultaneously.

## Security Guidelines

**Before ANY commit:**
- No hardcoded secrets (API keys, passwords, tokens)
- All user inputs validated at system boundaries
- SQL injection prevention (parameterized queries only)
- XSS prevention (sanitized HTML output)
- Authentication/authorization verified on every route
- Error messages do not leak sensitive data

**If a security issue is found:** STOP → invoke code-reviewer → fix CRITICAL issues → rotate any exposed secrets → scan codebase for similar patterns.

## Coding Style

- **tdd-workflow**: Test-driven development — write tests before implementation, 80%+ coverage
- **github-ops**: PR workflow, branch strategy, commit conventions, code review process
