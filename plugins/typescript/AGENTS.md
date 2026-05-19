# TypeScript — Agent Instructions

TypeScript language preset — type-safe coding style, idiomatic patterns, testing, security, and a dedicated TS code reviewer.

**Version:** 0.1.0

## Core Principles

1. **Type safety** — leverage TypeScript strictly; no `any` casts — use explicit types or generics
2. **Plan before execute** — use planner for any feature with more than 3 files changed
3. **Agent-first** — delegate domain tasks to specialized agents proactively
4. **Review always** — typescript-reviewer runs after every TypeScript change
5. **Test-driven** — write tests before implementation, 80%+ coverage

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| typescript-reviewer | TypeScript/JavaScript code review for type safety, async correctness, and idiomatic patterns | All TypeScript and JavaScript code changes |
| planner | Expert planning specialist for complex features and refactoring | Complex features, architectural changes |
| code-architect | Designs feature architectures with blueprints and build order | New module structure, architectural decisions |
| code-explorer | Traces execution paths and maps architecture layers | Understanding unfamiliar code before modifying |
| code-reviewer | Expert code review for quality, security, and maintainability | After writing or modifying any code |
| code-simplifier | Simplifies and refines code for clarity while preserving behavior | After implementing a feature, before PR |

## Agent Orchestration

Use agents **proactively without waiting for the user to ask**:

- Any TypeScript or JavaScript code written/modified → **typescript-reviewer**
- Complex feature requests (>3 files) → **planner**
- Code just written or modified → **code-reviewer**
- Architectural decisions → **code-architect**
- Understanding existing code before changes → **code-explorer**

Use parallel execution: run `typescript-reviewer` and `code-reviewer` simultaneously on the same change.

## Security Guidelines

**Before ANY commit:**
- No hardcoded secrets (API keys, passwords, tokens)
- All user inputs validated at system boundaries — use zod or class-validator
- SQL injection prevention (parameterized queries only)
- XSS prevention (sanitized HTML output)
- Never disable TypeScript strict checks or eslint rules
- Error messages do not leak sensitive data

**If a security issue is found:** STOP → invoke typescript-reviewer → fix CRITICAL issues → rotate any exposed secrets.

## Coding Style

- No `any` casts — use `unknown` + type guards or explicit generics
- Prefer immutability — create new objects rather than mutating
- Strict null checks — handle `undefined` explicitly, no non-null assertions unless provable
- Functions under 50 lines; files under 400 lines
- Handle errors at every level — never swallow silently
