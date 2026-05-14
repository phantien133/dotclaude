# Hilab Streaming — Agent Instructions

## Core Principles

- **Workflow-first** — all feature work starts with `/dev-task`; never write code directly without a `plan.md`
- **Type safety** — strict TypeScript throughout; no `any` casts; handle `undefined` explicitly
- **Test-Driven** — write failing tests before implementation; 80%+ coverage per module enforced in CI
- **API contracts first** — design GraphQL schema and DTOs before implementing service/resolver logic
- **Security-first** — every resolver needs an auth guard; `@Public()` requires an explicit justification comment
- **Verify before done** — run `verification-loop` before creating a PR; never skip on "it looks fine"

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **planner** | Expert planning specialist for complex features and refactoring | Any feature request; free prompt asking "how do I implement X"; Phase 1 plan generation |
| **code-architect** | Designs feature architectures by analyzing existing codebase patterns, providing implementation blueprints with concrete files, interfaces, data flow, and build order | "How should I structure X?"; new module design; unexpected cross-module dependency |
| **tdd-guide** | TDD specialist enforcing write-tests-first methodology; ensures 80%+ coverage | Any new code being written; bug fix; free prompt asking "write tests for X" |
| **code-reviewer** | Expert code review for quality, security, and maintainability | Immediately after any code is written or modified; before every PR |

## Agent Orchestration

**Use agents proactively without waiting for the user to ask:**

- User asks to implement a feature → **planner** (even outside workflow)
- User asks "how should I design / structure X" → **code-architect**
- Any code is written or modified → **code-reviewer** immediately after
- Bug fix or new feature about to be coded → **tdd-guide** before writing implementation
- User asks "is this code OK / LGTM?" → **code-reviewer**
- Code touches auth, payments, or wallet → **code-reviewer** + flag security section

**Inside `/dev-task` workflow:**

- Phase 1 (after `questions.md` answered) → **planner** generates `plan.md`
- Phase 4 (before assertions) → **tdd-guide** reviews test stubs
- Phase 4 (after GREEN) → **code-reviewer** scoped to `impact.md` affected files

**Parallel execution:** spawn independent agents simultaneously — e.g., **code-architect** analyzing module structure while **planner** drafts implementation steps.

## Streaming Workflow

The `/dev-task` skill orchestrates 8 phases. Each phase delegates to agents and skills:

| Phase | Agent / Skill invoked |
|-------|-----------------------|
| 0 — Intake | Plane MCP (`mcp__plane__retrieve_work_item_by_identifier`); GATE: developer confirms module |
| 0b — Context Load | `streaming-oq-check`; AUTO after GATE 0 |
| 1 — Plan | **planner** agent, `hsd-story-lint` |
| 2 — Impact & Design | `streaming-adr` (if arch decision found) |
| 3 — UI | `streaming-figma`, `build-ui-kit`, `build-static-page` |
| 4 — TDD | **tdd-guide** agent, `streaming-test-stubs`, `streaming-checkpoint`, **code-reviewer** agent |
| 5 — Verify | `verification-loop` |
| 6 — PR | `create-pr`, `hsd-post-merge` (after merge) |

## Skill Invocation — Stack-Aware Triggers

Invoke these skills proactively based on what is being worked on. Do not wait for the user to ask.

### NestJS / Backend

| When | Invoke |
|------|--------|
| Writing or reviewing a `module.ts`, `service.ts`, `resolver.ts`, `controller.ts`, `guard.ts`, or `dto/` | `nestjs-patterns` |
| Designing a GraphQL schema — new query, mutation, subscription, or `@ObjectType` | `api-design` |
| Writing or modifying `schema.prisma`, generating a migration, or writing a Prisma query | `postgres-patterns` |
| Running `prisma migrate dev` or creating a migration file | `database-migrations` |
| Touching auth guards, RBAC roles, JWT strategy, or any `@Public()` endpoint | `security-review` |
| Writing BullMQ processor, queue producer, or Redis pub/sub logic | `nestjs-patterns` + `backend-patterns` |

### Next.js / Frontend

| When | Invoke |
|------|--------|
| Writing or reviewing a Next.js page, layout, or server component in `src/app/` | `frontend-patterns` |
| Writing a client component, hook, or Apollo Client operation | `frontend-patterns` |
| Dealing with Next.js config, Turbopack, or build issues | `nextjs-turbopack` |
| Designing a new GraphQL query/mutation for the web client | `api-design` |

### Cross-cutting

| When | Invoke |
|------|--------|
| Before marking any task complete | `verification-loop` |
| Any TypeScript type error, `as any` cast, or unsafe narrowing | apply strict TS rules inline — no cast allowed |
| Free-prompt code session touching `.ts` or `.tsx` files without an active workflow | invoke `nestjs-patterns` or `frontend-patterns` based on file location |

## Security Guidelines

- No hardcoded secrets (API keys, RTMP keys, tokens, connection strings)
- Validate all inputs with NestJS class-validator DTOs — never trust raw request body
- Never bypass `JwtAuthGuard`; `@Public()` must have a comment explaining why
- Prisma raw queries (`$queryRaw`) require a code-review comment explaining why ORM was insufficient
- Never store JWT tokens in Redis; always use the DB `refresh_tokens` table
- Coin operations must go through the append-only `wallet_events` ledger — never mutate a balance column (ADR-003)

## Stack Notes

- **dev-task**: 8-phase dev workflow orchestrator — Phase 0 accepts Plane ticket URL or free title (fetches ticket via MCP), confirms module interactively; Phase 0b loads context; Phases 1–6: plan → impact → UI → TDD → verify → PR
- **streaming-figma**: Figma export decision tree — choose between MCP, Dev Mode, or Make export before calling build-ui-kit
- **streaming-oq-check**: filters streaming-docs Open Questions by module; output feeds `questions.md § Known constraints`
- **streaming-adr**: writes timestamped ADR entries to `streaming-docs/documents/overview/architecture-overview.md`
- **streaming-checkpoint**: creates structured `chore(workflow): [RED|GREEN]` git commits at TDD milestones
- **streaming-test-stubs**: generates NestJS / Prisma / BullMQ / GraphQL test skeletons from `impact.md`
- **build-ui-kit**: integrates Figma exports into `src/components/<module>/ui-kit/`
- **build-static-page**: builds Next.js pages from ui-kit components into `src/app/(app)/<module>/`
- **create-pr**: creates GitLab MR using `plan.md` as the description base
- **verification-loop**: runs build + typecheck + lint + test coverage + security scan for api and web
