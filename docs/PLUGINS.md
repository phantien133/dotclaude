# Plugin Index

All presets in this repo and their compiled plugin bundles under `plugins/`. Add new presets via `/preset-wizard` — the wizard updates this file automatically.

→ **[README.md](../README.md)** — install instructions  
→ **[PRESETS.md](PRESETS.md)** — preset schema and authoring guide  
→ **[DEVELOPMENT.md](DEVELOPMENT.md)** — how to author and publish presets

---

## Core

Cross-stack baselines. Stack-agnostic; designed to be inherited.

| Plugin | Preset docs | Description |
|--------|-------------|-------------|
| [`core`](../plugins/core/) | [presets/core/core/README.md](../presets/core/core/README.md) | Universal baseline — context management, productivity, semantic search. |
| [`ai-native`](../plugins/ai-native/) | [presets/core/ai-native/README.md](../presets/core/ai-native/README.md) | Extends `core` — AI self-learning and skill creation. |
| [`developer`](../plugins/developer/) | [presets/core/developer/README.md](../presets/core/developer/README.md) | Extends `ai-native` — GitHub ops, quality gates, architecture planning. |

---

## Framework

Stack or language-specific presets. Inherit from the `developer` chain.

| Plugin | Preset docs | Description |
|--------|-------------|-------------|
| [`nestjs`](../plugins/nestjs/) | [presets/framework/nestjs/README.md](../presets/framework/nestjs/README.md) | NestJS modular TypeScript backend — DTO validation, guards, database integration, API design. |
| [`nextjs`](../plugins/nextjs/) | [presets/framework/nextjs/README.md](../presets/framework/nextjs/README.md) | Next.js React app — Turbopack dev server, frontend patterns for production apps. |

---

## Purpose

Workflow or role-specific presets.

| Plugin | Preset docs | Description |
|--------|-------------|-------------|
| [`cistreaming`](../plugins/cistreaming/) | [presets/purpose/cistreaming/README.md](../presets/purpose/cistreaming/README.md) | Dev workflow for the cistreaming platform (NestJS + Next.js + SRS + GraphQL). |
| [`dotclaude-bootstrap`](../plugins/dotclaude-bootstrap/) | [presets/purpose/dotclaude-bootstrap/README.md](../presets/purpose/dotclaude-bootstrap/README.md) | First-time dotclaude setup — setup wizard, preset-creation wizard, debugger, plugin discovery. |
| [`dotclaude-self`](../plugins/dotclaude-self/) | [presets/purpose/dotclaude-self/README.md](../presets/purpose/dotclaude-self/README.md) | Full dotclaude working environment — preset authoring, self-learning, component picker, skill creator. |
