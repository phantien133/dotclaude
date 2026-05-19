# Next.js — Agent Instructions

Next.js framework preset — React app structure, Turbopack dev server, and frontend patterns for production apps.

**Version:** 0.1.0

## Core Principles

1. **Type safety** — leverage TypeScript strictly; no `any` casts
2. **Plan before execute** — use planner for any feature with more than 3 files changed
3. **Agent-first** — delegate domain tasks to specialized agents proactively
4. **API contracts first** — align on API shape with backend before building UI
5. **Verify before done** — run verification loop before marking a feature complete

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| typescript-reviewer | TypeScript/JavaScript code review for type safety and idiomatic patterns | All TypeScript and React code changes |
| planner | Expert planning specialist for complex features and refactoring | Complex features, new page/component design |
| code-architect | Designs feature architectures with blueprints and build order | New route structure, architectural decisions |
| code-explorer | Traces execution paths and maps architecture layers | Understanding existing component structure |
| code-reviewer | Expert code review for quality, security, and maintainability | After writing or modifying any code |
| code-simplifier | Simplifies and refines code for clarity | After implementing a feature, before PR |

## Agent Orchestration

Use agents **proactively without waiting for the user to ask**:

- Any TypeScript or React code written/modified → **typescript-reviewer**
- Complex feature requests (>3 files) → **planner**
- New page, layout, or major component → **code-architect**
- Code just written or modified → **code-reviewer**
- Understanding existing component structure → **code-explorer**

Use parallel execution: run `typescript-reviewer` and `code-reviewer` simultaneously.

## Security Guidelines

**Before ANY commit:**
- No hardcoded secrets — use `.env.local` and `NEXT_PUBLIC_` prefix only for safe values
- All user inputs validated on server actions and API routes
- XSS prevention — never use `dangerouslySetInnerHTML` without sanitization
- CSRF protection enabled on mutations
- Authentication state checked server-side; never trust client-only auth
- Error messages do not leak sensitive data

**If a security issue is found:** STOP → invoke code-reviewer → fix CRITICAL issues → rotate any exposed secrets.

## Coding Style

- **frontend-patterns**: React component patterns, state management, performance optimization
- **nextjs-turbopack**: Next.js app router, server/client components, Turbopack dev server
- **api-design**: API contract design for Next.js API routes and server actions
- **verification-loop**: Quality gate — run after implementing a feature or before PR
- No `any` casts — use explicit types or generics
- Prefer Server Components; only use `'use client'` when necessary
- Keep components small — under 150 lines; extract hooks for complex logic
