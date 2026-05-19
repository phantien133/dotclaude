# NestJS — Agent Instructions

NestJS framework preset — modular TypeScript backend with DTO validation, guards, database integration, and API design patterns.

**Version:** 0.1.0

## Core Principles

1. **Type safety** — leverage TypeScript strictly; no `any` casts
2. **API contracts first** — design endpoints before implementing; use OpenAPI/Swagger
3. **Test-driven** — write tests before implementation, 80%+ coverage
4. **Security-first** — validate all inputs with DTOs, check auth on every route
5. **Verify before done** — run verification loop before marking a feature complete
6. **Agent-first** — delegate domain tasks to specialized agents proactively

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| typescript-reviewer | TypeScript/JavaScript code review for type safety and idiomatic patterns | All TypeScript code changes |
| planner | Expert planning specialist for complex features and refactoring | Complex features, new module design |
| code-architect | Designs feature architectures with blueprints and build order | New NestJS modules, architectural decisions |
| code-explorer | Traces execution paths and maps architecture layers | Understanding existing module structure |
| code-reviewer | Expert code review for quality, security, and maintainability | After writing or modifying any code |
| code-simplifier | Simplifies and refines code for clarity | After implementing a feature, before PR |

## Agent Orchestration

Use agents **proactively without waiting for the user to ask**:

- Any TypeScript code written/modified → **typescript-reviewer**
- New NestJS module or service design → **code-architect** then **planner**
- Complex feature requests (>3 files) → **planner**
- Code just written or modified → **code-reviewer**
- Understanding existing module before changes → **code-explorer**

Use parallel execution: run `typescript-reviewer` and `code-reviewer` simultaneously.

## Security Guidelines

**Before ANY commit:**
- No hardcoded secrets — use `@nestjs/config` with environment variables
- All inputs validated via class-validator DTOs; never trust raw request body
- Guards on every protected route — never skip `@UseGuards()`
- SQL injection prevention — use TypeORM query builder or parameterized queries
- XSS prevention — sanitize all HTML output
- Rate limiting on all public endpoints
- Error messages do not leak sensitive data — use NestJS exception filters

**If a security issue is found:** STOP → invoke code-reviewer → fix CRITICAL issues → rotate any exposed secrets.

## Coding Style

- **nestjs-patterns**: Modules, controllers, providers, DTO validation, guards, interceptors
- **backend-patterns**: REST error handling, response shaping, generic backend patterns
- **api-design**: API contract design and OpenAPI/Swagger documentation
- **database-migrations**: TypeORM / Prisma migration patterns
- **postgres-patterns**: PostgreSQL query patterns and optimization
- **security-review**: Security vulnerability scanning and input validation
- **verification-loop**: Quality gate — run after implementing a feature or before PR
- No `any` casts — use explicit types or generics
- DTOs for all inputs; serializers for all outputs
- Functions under 50 lines; controllers thin, services thick
