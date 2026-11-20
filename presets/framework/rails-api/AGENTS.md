# Rails API — Agent Instructions

Ruby on Rails API-only preset — 37signals-style Rails conventions, RSpec testing, safe Postgres migrations, security, jobs, and webhooks.

**Version:** 0.1.0

## Core Principles

1. **Test-driven with RSpec** — write the request/model spec first (FactoryBot, `build` over `create`); follow `rails-testing`
2. **Vanilla Rails first** — rich models, concerns, and REST resources before service-object layers; follow `rails-best-practices-core`
3. **API contracts first** — define routes, status codes, and JSON shapes before implementing; follow `api-design`
4. **Safe migrations** — reversible, lock-aware, backfills separated from schema changes; review with `database-reviewer`
5. **Security-first** — strong params, scoped lookups (`current_user.things.find`), authorization on every endpoint
6. **Verify before done** — run `bundle exec rspec` + `bundle exec rubocop` (+ `brakeman` if present) before marking complete

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| planner | Expert planning specialist for complex features and refactoring | Complex features (>3 files), new resources/domains |
| code-architect | Designs feature architectures with blueprints and build order | New models/resources, architectural decisions |
| code-explorer | Traces execution paths and maps architecture layers | Understanding existing controllers/models/jobs |
| code-reviewer | Expert code review for quality, security, and maintainability | After writing or modifying any code |
| code-simplifier | Simplifies and refines code for clarity | After implementing a feature, before PR |
| database-reviewer | PostgreSQL specialist for queries, schema design, migrations, performance | Any migration, new index, complex ActiveRecord query, N+1 suspicion |
| tdd-guide | Test-first methodology, 80%+ coverage | New feature or bug fix — apply its flow with RSpec (its examples are JS) |

## Agent Orchestration

Use agents **proactively without waiting for the user to ask**:

- Complex feature requests (>3 files) → **planner**
- Code just written or modified → **code-reviewer**
- Architectural decisions or new resource/domain structure → **code-architect**
- Bug fix or new feature → **tdd-guide** (write the failing spec first)
- New/changed migration, `db/schema.rb` diff, or slow query → **database-reviewer**

Use parallel execution for independent sub-tasks — launch multiple agents simultaneously.

Slash-only skills (not auto-loaded — invoke explicitly when relevant):
`/rails-migrations`, `/rails-security-multitenancy`, `/rails-jobs`, `/rails-webhooks`, `/dhh` (opinionated review).

## Security Guidelines

**Before ANY commit:**
- No hardcoded secrets — use `Rails.application.credentials` or ENV
- All params go through strong parameters (`params.expect` / `params.require(...).permit(...)`)
- SQL injection prevention — no string interpolation in `where`/`order`/`find_by_sql`; use bind params
- Records looked up through the owning scope (`current_account.projects.find(id)`), never a bare `Model.find`
- Authentication/authorization verified on every controller action
- Error responses do not leak stack traces, SQL, or internal IDs

**If a security issue is found:** STOP → run `security-bounty-hunter` (and `brakeman` if installed) → fix CRITICAL issues → rotate any exposed secrets → scan codebase for similar patterns.

## Coding Style

- **rails-best-practices-core**: core Rails architecture, naming, safety, maintainability
- **rails-testing**: RSpec design, FactoryBot data, request/model/job specs, suite performance
- **rails-migrations**: reversible, lock-aware migrations and rollout sequencing
- **rails-security-multitenancy**: tenant scoping, auth, SSRF/CSRF, rate limiting
- **rails-jobs**: Active Job orchestration, idempotency, safe retries
- **rails-webhooks**: webhook delivery, retries, signature verification, observability
- **postgres-patterns** / **database-migrations**: PostgreSQL query, index, and zero-downtime schema patterns
- **api-design** / **backend-patterns**: REST contracts, error shapes, response structure
- Follow the project's RuboCop config; do not disable cops inline without a reason
- Methods under 20 lines, classes under 200 lines; handle errors explicitly — never `rescue => e` and swallow
