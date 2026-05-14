---
description: Knowledge injection for the Hilab streaming platform — stack, module status, ADRs, Open Questions, and docs pointers.
globs: ["**/*"]
---

# Hilab Streaming Platform — Context

Repo: `streaming-workspace` (monorepo)
Docs: `streaming-docs/documents/` (ground truth for module status, ADRs, OQs)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | NestJS (modular monolith), GraphQL code-first (Apollo Server) |
| ORM | Prisma + PostgreSQL |
| Realtime | GraphQL Subscriptions (graphql-ws), Redis pub/sub fan-out |
| Cache / Locks | Redis (sessions, viewer count, rate limits, distributed locks) |
| Async Jobs | BullMQ (media transcoding, coin settlement, notifications) |
| Web | Next.js (React 18), Apollo Client |
| Media | SRS v6 (RTMP ingest, LL-HLS output), FFmpeg worker, CloudFront CDN |
| Auth | JWT (access 15m / refresh 7d), OAuth2 (Google live; Facebook/Apple deferred) |
| Testing | Jest (unit + integration), Docker Compose test stack |
| Target | ~1,000 concurrent viewers, <3s HLS latency, <500ms p95 fan-out |

---

## Module Implementation Status

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 00 | Foundation | complete | NestJS scaffold, Prisma, Redis, BullMQ, GraphQL, error handling |
| 01 | Auth | mostly done | JWT + refresh + Google OAuth; Facebook/Apple/signup page deferred |
| 02 | User | partial | Public profile + streamer listing; RBAC + follow graph deferred |
| 03 | Stream | partial | RTMP key lifecycle, SRS callbacks, transcode queue; subscriptions deferred |
| 04 | Chat | not started | Design outlined: persistence, Redis fan-out, rate limit, ban enforcement |
| 05 | Engagement | not started | Reactions, polls, Q&A, emotes, viewer count |
| 06 | Monetization | blocked | Blocked by OQ-001 (payment gateway) + OQ-002 (payout mechanism) |
| 07 | Leaderboard | not started | Coin-based leaderboard snapshots |
| 08 | Moderation | not started | Bans, reports; workflow TBD (OQ-005) |
| 09 | Notification | not started | Push (OQ-010: FCM/APNs), in-app |
| 10 | Admin | not started | Analytics, user/stream management |
| 11 | Storage | not started | Asset management (S3 / volume TBD: OQ-015) |
| 12 | AI Streamer | research | Research complete (Mode B recommended); blocked by OQ-018–022 |

---

## Active Open Questions

| ID | Title | Impact |
|----|-------|--------|
| OQ-001 | Payment Gateway Selection | BLOCKS Monetization |
| OQ-002 | Streamer Payout Mechanism | BLOCKS Monetization |
| OQ-003 | Anonymous Viewer Support | Affects Auth + Chat |
| OQ-004 | Coin Refund & Dispute Flow | Affects Monetization |
| OQ-005 | Moderation Workflow (auto vs manual) | Affects Moderation |
| OQ-007 | SRS Callback Failure Handling + retry | Affects Stream |
| OQ-008 | Chat Storage Strategy (high-volume) | Affects Chat |
| OQ-009 | WebSocket Reconnect Strategy | Low urgency |
| OQ-010 | Push Notification Provider (FCM/APNs) | Low urgency |
| OQ-011 | Logging Stack (Loki vs ELK) | Low urgency |
| OQ-012 | Chinese Social Login (WeChat/Weibo) | Low urgency |
| OQ-015 | HLS Output Transport (shared volume vs S3) | Affects Stream/Storage |
| OQ-017 | SRS HLS Fallback Latency Tuning | Low urgency |
| OQ-018 | AI Streamer mode selection (Mode A real-time vs Mode B pre-recorded vs Hybrid) | Blocks AI Streamer |
| OQ-019 | China market scope — GFW strategy for AI Streamer | Blocks AI Streamer |
| OQ-020 | Avatar type selection (LiveAvatar vs Digital Twin) | Blocks AI Streamer |
| OQ-021 | LLM provider for AI chat (OpenAI vs Anthropic vs HeyGen Full) | Blocks AI Streamer |
| OQ-022 | AI Streamer content refresh cadence (daily/weekly/on-demand) | Blocks AI Streamer |

Full detail: `streaming-docs/documents/overview/open-questions.md`

**Rule:** Do NOT resolve OQs unilaterally. Surface them in Phase 0b (`context.md § Known Constraints`) and Phase 1 (`questions.md`); wait for developer decision before proceeding.

---

## Key ADRs (Resolved)

| ADR | Decision |
|-----|----------|
| ADR-001 | RTMP key lifecycle — Argon2id-hashed, rate-limited rotation |
| ADR-002 | Media server — SRS self-hosted (not AWS IVS) for cost + control |
| ADR-003 | Coin economy — event-first append-only ledger (no mutable balance column) |
| ADR-004 | API style — GraphQL code-first (not REST) for realtime + mobile |

Full list: `streaming-docs/documents/overview/architecture-overview.md`

---

## Directory Map

```
streaming-workspace/
├── streaming-api/
│   └── src/
│       ├── modules/<name>/        # feature modules — NO NN prefix in code (e.g. auth, stream, user)
│       ├── common/                # shared guards, decorators, exceptions, types
│       ├── config/                # config slices (env validation)
│       ├── database/              # Prisma client setup
│       ├── graphql/               # Apollo Server / schema wiring
│       ├── redis/                 # Redis service
│       ├── queue/
│       │   └── processors/        # BullMQ job processors
│       ├── transcode-worker/      # FFmpeg transcode worker process
│       ├── worker/                # Generic BullMQ worker entry
│       ├── health/                # Health-check endpoint
│       └── app/                   # App module entry
│   └── prisma/                    # schema.prisma + migrations/
├── streaming-web/
│   └── src/
│       ├── features/<name>/       # feature slices (queries, mutations, hooks) — matches API module name
│       ├── components/            # shared UI components (ui/, admin/ sub-dirs)
│       ├── app/                   # Next.js App Router
│       │   ├── (app)/             # authenticated route group
│       │   ├── auth/              # OAuth callback routes
│       │   ├── login/             # login page
│       │   ├── admin/             # admin pages
│       │   └── api/               # BFF API routes (Next.js Route Handlers)
│       ├── lib/                   # shared utilities, error helpers
│       └── __generated__/graphql/ # Apollo codegen output
└── streaming-docs/
    ├── documents/modules/<NN>-<name>/   # README.md + api.md + workflow-links.md
    │   └── features/                    # one <feature-name>.md per feature (e.g. sign-up.md, oauth-google.md)
    │                                    # NOTE: docs use <NN>-<name>; code uses <name> only
    ├── documents/overview/              # architecture-overview.md + open-questions.md
    ├── documents/database/              # schema docs + PlantUML ERDs
    └── workflow/<task-slug>/            # task workflow state (state.yaml + intake.md + context.md + …)
```

---

## Workflow Convention

All feature work uses `/dev-task`. Do NOT write code directly without a `plan.md`.

Small fixes and chores (<30 min): conventional commit only — no full workflow required.

For detail on any module, read `streaming-docs/documents/modules/<NN>-<name>/README.md`.
