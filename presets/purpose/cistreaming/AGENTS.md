# cistreaming — Agent Instructions

This is the **cistreaming platform** Claude Code preset — a NestJS + Next.js + SRS + GraphQL live-streaming application. The preset provides a structured 8-phase feature workflow (`/w-task`), a lightweight fix workflow (`/w-fix`), and a Figma-to-code pipeline (`/f-*`), all driven by `.claude/workflow.yaml`.

**Version:** 1.0.0

## Core Principles

1. **Workflow-First** — all feature work goes through `/w-task`; small fixes through `/w-fix`. Never write code without a plan.
2. **Test-Driven** — write tests before implementation; 80%+ branch/function/line coverage required per module.
3. **Layer Separation** — no business logic in resolvers; no direct Prisma calls in resolvers; all DB access through the service layer.
4. **Docs Ship With Code** — doc updates are committed in the same branch as code changes; `w-doc-gate` blocks PR creation if docs are missing.
5. **Explicit Gates** — the workflow advances only when the developer runs `/w-task` or `/w-fix`. Chat during pauses; never auto-advance.
6. **AppException Hierarchy** — all errors extend `AppException`; every new error gets a code in `error-codes.ts`.

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `planner` | Feature implementation planning | Phase 1 of `/w-task` — after `questions.md` is filled |
| `tdd-guide` | TDD enrichment and edge-case coverage | Phase 4 of `/w-task` — after `w-test-stubs` writes boilerplate |
| `code-reviewer` | Code quality, security, and NestJS/streaming conventions | Phase 4 of `/w-task` after GREEN; on demand at any gate |
| `code-explorer` | Codebase survey — execution paths, module map, patterns | `/w-document-build-up` Phase 1 — legacy doc backfill |
| `code-architect` | ADR extraction and OQ identification from existing code | `/w-document-build-up` Phase 3 — legacy doc backfill |
| `code-simplifier` | Refactoring for clarity without behavior change | On demand — post-GREEN cleanup, MEDIUM review findings |

## Agent Orchestration

Use agents proactively without waiting for user prompt:

- Feature implementation requested → **`planner`** (Phase 1)
- Test boilerplate written by `w-test-stubs` → **`tdd-guide`** (Phase 4)
- Implementation GREEN and checks pass → **`code-reviewer`** (Phase 4)
- Code just written or modified outside workflow → **`code-reviewer`** (immediately)
- Legacy codebase with no streaming-docs → **`code-explorer`** then **`code-architect`** (via `/w-document-build-up`)
- MEDIUM review finding about complexity → **`code-simplifier`** (on demand)

Spawn independent agents in parallel when tasks do not depend on each other — e.g. `tdd-guide` enriching one module's tests while `code-reviewer` reviews another's diff.

## Security Guidelines

**Before any commit:**
- No hardcoded secrets (API keys, JWT secrets, DB passwords, RTMP credentials)
- All user inputs validated at system boundaries (DTOs with class-validator)
- `prisma.$queryRaw` / `prisma.$executeRaw` used only with parameterized queries — never string concatenation
- Every resolver/controller without `@UseGuards` must have an inline comment with `@Public: <reason>`
- JWT tokens never stored in Redis — only in `refresh_tokens` DB table (ADR-001 derivative)
- Rate limiting configured on all public-facing endpoints

**RTMP key policy (ADR-001):** keys are Argon2id-hashed server-side; rotation is rate-limited. Never expose raw RTMP keys in logs or API responses.

**If a security issue is found:** STOP → use `code-reviewer` agent with `--focus security` → fix CRITICAL issues → check for similar patterns across the module → commit separately with `fix(security):` prefix.

## Coding Style

**Layer rules (CRITICAL):**
- Resolvers: call service methods and return results only — no `prisma.*` calls, no business conditionals.
- Services: own all business logic, call Prisma, dispatch BullMQ jobs, publish Redis events.
- Cross-module access: import from the module's public barrel (`index.ts`), never from internal paths.

**Error handling:**
- Never `throw new Error(message)` in business logic — always `throw new HandledException(ErrorCode.X, { ... })` or `throw new UnexpectedException(ErrorCode.X, cause)`.
- Every new error code must be registered in `src/common/exceptions/error-codes.ts`.
- BullMQ processors must handle `UnrecoverableError` for permanent failures (bad data, constraint violations).

**TypeScript strictness:**
- `noUncheckedIndexedAccess` is enabled — array access returns `T | undefined`; always guard before use.
- `exactOptionalPropertyTypes` is enabled — never assign `undefined` to an optional field explicitly.
- Never use `any` — use `unknown` with type narrowing, or the actual domain type.

**Naming conventions:**
- GraphQL mutations: `verb + noun` — `sendGift`, `startStream`, `giftCoins` (not `createGiftTransaction`).
- BullMQ queue names: `<module>:<action>` — `gift:fan-out`, `stream:transcode` (not `giftFanOut`).
- Redis pub/sub channels: `<module>:<event>` — `gift:notify`, `stream:viewer-joined`.

**Code quality checklist:**
- Functions under 50 lines, files under 800 lines
- No deep nesting (>4 levels) — use early returns
- No `console.log` in production code — use NestJS `Logger`
- No soft-deleted records hard-deleted — `deletedAt DateTime?` pattern only

## Testing Requirements

**Minimum coverage: 80% per module** (branches, functions, lines, statements).

Test layers — all required per affected area:

| Layer | Stack | Approach |
|-------|-------|---------|
| Unit | NestJS service | Mock `PrismaService` via `jest.mock` or `prisma-mock`; never hit real DB |
| GraphQL | Apollo + NestJS | `Test.createTestingModule` with real resolver + mocked service |
| BullMQ unit | Processor | Mock queue and Redis; test job handler logic in isolation |
| BullMQ integration | Processor + Redis | `docker-compose.test.yml` — real Redis at `localhost:6379` |
| Integration | Full module | Real Postgres + Redis via `docker-compose.test.yml` |
| E2E | Next.js + API | Playwright for critical user flows |

**TDD workflow (mandatory for `/w-task`):**
1. `w-test-stubs` writes layer-aware boilerplate → tests are RED.
2. `tdd-guide` enriches assertions and edge cases.
3. Developer approves test structure (GATE 4 mini).
4. `w-checkpoint RED` commits.
5. `tdd-workflow` skill drives RED → GREEN → refactor.
6. `w-checkpoint GREEN` commits.
7. `code-reviewer` reviews — CRITICAL/HIGH resolved; tests re-run.

**Edge cases to always cover:**
- Null / undefined inputs reaching service methods
- Entity not found → correct `HandledException` with registered error code
- Duplicate event / idempotency — processing the same job twice must not double-publish
- Permission boundary — unauthenticated caller receives `UnauthorizedException`
- Redis unavailable → processor handles `ECONNREFUSED` with `UnrecoverableError`

## Development Workflow

1. **Story validation** — run `/hsd-story-lint <story.md>` before starting a ticket.
2. **Setup check** — confirm `.claude/workflow.yaml` exists; run `/w-setup` if missing.
3. **Start task** — `/w-task <issue-url | #N | title>` for features; `/w-fix <description>` for small fixes (<3 files, <2h, no schema change).
4. **Plan** — fill `questions.md`, review `plan.md` (Phase 1). Challenge scope before approving — changes after Phase 2 are expensive.
5. **Impact review** — read `impact.md` sequence diagram carefully (Phase 2). Request revisions until design matches mental model.
6. **TDD** — approve test structure, review GREEN diff and `verify.md` before committing (Phase 4).
7. **Docs** — review `features/<name>.md`, `api.md`, sub-ERD, and master ERD before running `/w-pr` (Phase 5).
8. **PR** — `/w-pr <task-slug>` runs `w-doc-gate` first; fix any flagged missing docs before PR is created.

**Capture decisions in the right place:**
- Architectural decisions → append ADR entry to `architecture-overview.md` via `w-adr`.
- Unresolved questions → add OQ entry to `open-questions.md`; do not resolve OQs unilaterally.
- Feature design → `features/<feature-name>.md` via `w-feature-record`.
- API surface → `api.md` via `w-api-doc`.

## Git Workflow

**Commit format:** `<type>(<scope>): <description>` — types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`.

**Two commits per feature task:**
1. Code commit — `feat(<module>): <one-line summary>` — staged from `impact.md § Affected Files` only; never `git add -A`.
2. Docs commit — `docs(<module>): persist <feature-name> design from <task-slug>` — staged from doc paths only.

Both commits ship in the same PR branch. Reviewers can read them independently.

**Checkpoint commits (TDD):**
- `chore: RED checkpoint — <task-slug>` — tests written, implementation pending.
- `chore: GREEN checkpoint — <task-slug>` — tests passing, refactor done.

Use `git diff RED..GREEN` to show the full TDD implementation delta.

## Architecture Patterns

**Module structure:** `module.ts` → `service.ts` → `resolver.ts` → `dto/` → `errors.ts`. Every module owns its domain; cross-module access via injected services only — never HTTP calls between modules.

**Coin economy (ADR-003):** balance = sum of `wallet_events` ledger — never a mutable `balance` column. Any plan proposing a `balance` field must be rejected.

**Async fan-out:** any operation with more than one subscriber goes through BullMQ, not inline `await`. Queue name: `<module>:<action>`.

**Redis patterns:**
- Distributed locks: always set TTL — never acquire without timeout.
- Viewer count: HyperLogLog — not an integer counter.
- Pub/sub channels: `<module>:<event>` pattern.

**GraphQL conventions:**
- `@ObjectType()` for output, `@InputType()` for input — never mix.
- `@ResolveField` for computed or joined fields.
- All nullable fields: `@Field(() => Type, { nullable: true })` explicit declaration required.
- Subscriptions: `graphql-ws` only — not `subscriptions-transport-ws`.

**OQ guardrail:** check `open-questions.md` before implementing anything that touches a blocked module (Monetization, Moderation, AI Streamer). Do not resolve OQs unilaterally — surface them in `context.md` and `questions.md` and wait for developer decision.

## Performance

**Context management:** avoid the last 20% of context window for multi-file features and full-module refactors. Single-file edits and doc updates tolerate higher utilization.

**Query safety:**
- Never `prisma.<model>.findMany()` without a `where` clause on large tables.
- N+1 queries: use `include` or batch queries — never fetch related data in a loop.
- Always set `take` limit on user-facing paginated queries.

**BullMQ workers:** never call Prisma from within job handlers without try/catch. Use `UnrecoverableError` for permanent failures to prevent infinite retries.

## Project Structure

```
streaming-api/src/
  modules/<name>/         — NestJS feature modules (no NN prefix in code)
  common/                 — Shared guards, decorators, exceptions, types
  queue/processors/       — BullMQ job processors
  prisma/                 — Prisma schema + migrations

streaming-web/src/
  features/<name>/        — Apollo queries, mutations, hooks (mirrors API module name)
  app/                    — Next.js App Router pages

streaming-docs/
  documents/modules/<NN>-<name>/  — Per-module docs (NN prefix in docs only)
    README.md, api.md, features/, workflow-links.md
  documents/database/     — Schema docs + PlantUML ERDs
  documents/overview/     — architecture-overview.md (ADRs), open-questions.md
  workflow/<task-slug>/   — Task state files (intake, context, plan, impact, tests, verify)
```

Note: code dirs use `<name>` only; doc dirs use `<NN>-<name>`. Never confuse them.

## Success Metrics

- All tests pass with 80%+ coverage per module
- No CRITICAL or HIGH issues from `code-reviewer`
- `w-doc-gate` passes without `--skip-doc-gate`
- Master ERD is in sync with all sub-ERDs
- No OQs resolved unilaterally — all decisions recorded in ADRs
- Conventional commits on every change
