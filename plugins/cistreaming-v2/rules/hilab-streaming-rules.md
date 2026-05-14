---
description: Behavioral guidelines for working in the Hilab streaming codebase — coding conventions, architecture guardrails, testing requirements, and workflow habits.
globs: ["**/*.ts", "**/*.tsx"]
---

# Hilab Streaming — Project Rules

## § NestJS module structure

Every feature module follows: `module.ts` → `service.ts` → `resolver.ts` (or `controller.ts` for REST) → `dto/` → `errors.ts`.

- No business logic in resolvers — resolvers only call services
- No direct Prisma calls in resolvers — always go through service layer
- Module owns its domain; cross-module access via injected services, not HTTP calls

## § GraphQL code-first conventions

- `@ObjectType()` for output, `@InputType()` for input — never mix
- `@ResolveField` for computed/joined fields — do not over-fetch in parent query
- All nullable fields: `@Field(() => Type, { nullable: true })` explicitly
- Subscriptions use `graphql-ws` — not `subscriptions-transport-ws`
- Mutation naming: verb + noun (e.g., `sendMessage`, `startStream`, `giftCoins`)

## § Prisma conventions

- Every model: `id String @id @default(uuid())`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
- Soft delete: `deletedAt DateTime?` — never hard delete user/stream/wallet records
- Migrations: always `prisma migrate dev --name <descriptive-name>`, never `db push` on shared envs
- Never `prisma.$queryRaw` without a comment explaining why ORM was insufficient

## § Error handling

- All errors extend `AppException` — `HandledException` for expected domain errors, `UnexpectedException` for 500s
- Every new error gets a code in the error code registry: `src/common/exceptions/error-codes.ts`
- Never `throw new Error(message)` directly in business logic

## § BullMQ / async patterns

- Any operation fanning out to >1 subscriber must go through BullMQ, not inline `await`
- Queue names: `<module>:<action>` (e.g., `stream:transcode`, `gift:fan-out`)
- All processors must handle `UnrecoverableError` for permanent failures
- Workers never call Prisma from within job handlers without try/catch

## § Redis usage

- Distributed locks: always set TTL — never acquire without timeout
- Pub/sub channel names: `<module>:<event>` pattern
- Never store JWT tokens in Redis — use DB `refresh_tokens` table
- Viewer count: Redis HyperLogLog, not integer counter

## § Architecture guardrails

- Check `streaming-context.md` OQ flags before implementing a blocked module — do not resolve OQs unilaterally
- Modular monolith: modules communicate via injected services, not HTTP calls between them
- Coin balance = sum of `wallet_events` ledger — never a mutable `balance` column (ADR-003)
- RTMP key: Argon2id-hashed, rate-limited rotation (ADR-001)

## § Testing requirements

- Unit tests: mock Prisma via `jest.mock(PrismaService)` or `prisma-mock` — never hit real DB in unit tests
- Integration tests: `docker-compose.test.yml` for real Postgres + Redis
- Minimum 80% coverage per module, enforced in CI
- Test file location mirrors source: `src/modules/chat/chat.service.spec.ts`
- BullMQ unit: mock queue; BullMQ integration: real Redis

## § Document governance

Documents are updated AFTER implementation — not during. Full policy in `streaming-docs-governance.md` rule.

- Module code change → update `streaming-docs/documents/modules/<NN>-<module>/README.md`
  - Code dir = `src/modules/<module>/` (no NN); doc dir = `documents/modules/<NN>-<module>/` (with NN)
- GraphQL schema change → also update `streaming-docs/documents/modules/<NN>-<module>/api.md`
- DB migration → update `streaming-docs/documents/database/`
- OQ resolved → move from `open-questions.md` to `architecture-overview.md` ADR section
- Complex design (>3 service interactions, state machine, external integration) → companion `.md` file in module doc folder
- Workflow task → `workflow-links.md` row in module doc folder

## § Workflow habit

- Feature work: always start with `/dev-task` — do not code directly without a `plan.md`
- Small bug fixes and chores (<30 min): exempt from full workflow, still need a conventional commit
- Figma imports: `/f-setup` once per project, then `/f-import` per design handoff

## § Common pitfalls (don't)

- Don't `console.log` in production code — use NestJS `Logger`
- Don't add `@Public()` to a resolver without a comment explaining why auth is intentionally bypassed
- Don't call `prisma.user.findMany()` without a `where` clause on a large table
- Don't commit `.env` files or secrets
- Don't use `any` type — use `unknown` + narrow, or the actual domain type
- Don't import from a sibling module's internal path — import from the module's public barrel (`index.ts`)
