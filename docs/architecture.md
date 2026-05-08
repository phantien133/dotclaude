# Architecture & Design Decisions

> Updated 2026-05-08 sau Phase 0 + Phase 1 redesign. Skeleton model
> (`packages/` + bash installer) đã wipe (xem `redesign-plan.md` Section 5.2).

## Mục tiêu sau redesign

`dotclaude` là repo cá nhân quản lý **trọn bộ kit Claude Code** — không chỉ là wrapper
cho upstream, mà là source-of-truth do owner kiểm soát:

1. **`claudekit/`** — bộ core đầy đủ (agents, skills, commands, hooks, rules) với
   provenance per-component. Owner copy nội dung từ upstream, có thể edit, track
   nguồn qua sidecar.
2. **`presets/`** — pure manifest (YAML) trỏ vào component IDs trong claudekit/.
   Không chứa code component.
3. **`scripts/`** — TypeScript installer (chạy qua tsx) đọc preset → install vào
   target user/project, manifest tracking, deps resolution.
4. **`upstream/`** — submodules (ECC + 3 docs sources) đóng vai trò sync source +
   docs reference, KHÔNG còn là runtime dependency.
5. **`plugins/`** — placeholder cho Phase 4 (preset → plugin bundle, publish lên
   self-hosted marketplace).

## Layout

```
dotclaude/
├── CLAUDE.md
├── README.md
├── dependencies.yaml          # Upstream sources + pinned commits
├── package.json + tsconfig.json + vitest.config.ts + pnpm-lock.yaml
│
├── claudekit/                 # Core kit (CQ-1a)
│   ├── agents/                # File-component: <name>.md + <name>.source.yaml
│   ├── skills/<name>/         # Folder-component: SKILL.md + SOURCE.yaml (+ assets)
│   ├── commands/              # File-component
│   ├── hooks/                 # File-component (script)
│   ├── rules/                 # File-component
│   ├── private/               # GITIGNORED (CQ-4a) — mirror cấu trúc public
│   └── private.example/       # TRACKED skeleton, hướng dẫn init private
│
├── presets/                   # Pure manifest (CQ-3c)
│   ├── core/<name>.yaml + .md       # baseline cross-stack
│   ├── framework/<name>.yaml + .md  # framework-specific
│   ├── purpose/<name>.yaml + .md    # task-specific
│   ├── private/                     # GITIGNORED
│   ├── private.example/             # TRACKED
│   └── schema/                      # JSON Schema được generate từ zod
│       ├── preset.schema.json
│       ├── sidecar.schema.json
│       └── manifest.schema.json
│
├── plugins/                   # Phase 4 build artifacts (rỗng đến Phase 4)
│
├── upstream/                  # Submodules (sync source + docs)
│   ├── everything-claude-code/    role: sync_source
│   ├── anthropic-cookbook/        role: docs
│   ├── anthropic-skills/          role: docs
│   └── mcp-servers/               role: docs
│
├── scripts/                   # 100% TypeScript, tsx runner
│   ├── install.ts             # Entry: validate | list | user | project
│   ├── sync-from-upstream.ts  # Diff sidecar.commit ↔ upstream HEAD
│   ├── generate-schemas.ts    # zod → JSON Schema
│   ├── lib/
│   │   ├── schema.ts          # zod schemas
│   │   ├── yaml.ts            # CORE_SCHEMA loader (no auto-Date)
│   │   ├── paths.ts           # repo + subdir resolvers
│   │   ├── sidecar.ts         # locate + load sidecar
│   │   ├── preset.ts          # locate + load preset
│   │   ├── upstream.ts        # dependencies.yaml lookup
│   │   └── logger.ts          # uniform output
│   └── tests/                 # Vitest (schema + fixtures)
│
└── docs/
    ├── architecture.md        # File này
    ├── redesign-plan.md       # 5-phase plan (in progress)
    ├── clarifying-questions.md  # Decisions log của 12 CQ
    ├── PROVENANCE.md          # Sidecar schema + sync workflow
    ├── PRESETS.md             # Preset schema + writing guide
    ├── PRIVATE.md             # private/ convention + bootstrap
    └── INSTALL.md             # Installer usage
```

## Decisions chính (chốt qua 12 CQ)

| # | Decision | Reference |
|---|---|---|
| CQ-1a | Top-level core: `claudekit/` (explicit, brandable) | clarifying-questions.md |
| CQ-1b | Internal layout: type-first (ECC style), naming prefix `web-`, `python-`, ... cho domain | |
| CQ-1c | Import mode: copy thuần — owner kiểm soát nội dung | |
| CQ-1d | Modify tracking: edit thẳng + sidecar `modified` flag | |
| CQ-2 | Sidecar YAML — file-component `<name>.source.yaml`, folder-component `SOURCE.yaml` (excluded khi install) | docs/PROVENANCE.md |
| CQ-3a/b/c/d | Preset: YAML + companion MD, schema validation qua header `# yaml-language-server: $schema=...`, folder theo kind, `extends:` ngay Phase 1 | docs/PRESETS.md |
| CQ-4a/b/c/d | `private/` per top package, mirror public, `private.example/` skeleton tracked, manual cloud-sync bootstrap | docs/PRIVATE.md |
| CQ-5a/b/c/d/e | User+Project Phase 1; user=symlink default, project=copy default; backup-then-overwrite; idempotent MUST; manifest YAML tracking | docs/INSTALL.md |
| CQ-6 | Marketplace self-hosted (`phantien133/claudekit-marketplace`), 1-1 preset↔plugin, defer Phase 4 | redesign-plan.md §5.6 |
| CQ-7 | `vendor/` → `upstream/`, ECC role: sync_source | |
| CQ-9 | Migration: wipe & rewrite (không migrate skeleton cũ) | |
| CQ-10 | 100% TS + pnpm + tsx (revised từ Bun do toolchain) | |
| CQ-11 | YAML cho file owner control; JSON cho convention bên ngoài (settings.json, package.json, JSON Schema, plugin manifest) | |
| CQ-12 | Sidecar có `dependencies.required/optional/external`; resolver auto-include required, skip optional default, warn-only external | docs/PROVENANCE.md |

## Resolver flow (Phase 2 sẽ implement đầy đủ)

```
preset.yaml
  ↓ load + validate (zod)
  ↓ resolve extends (recursive, dedupe diamond, detect circular)
  ↓ flatten components into ComponentRef[]
  ↓ for each component:
     ↓ locate in claudekit/<type>/<id> (public) → fallback claudekit/private/<type>/<id>
     ↓ load sidecar
     ↓ recurse on dependencies.required (auto-include, log)
     ↓ probe dependencies.external (which/version check, warn-only)
  ↓ merge settings_patch (deep-merge left-fold)
  ↓ build InstallPlan { ops, settingsPatch, externalDeps, depLog }
  ↓ apply qua fs-ops (symlink/copy with backup)
  ↓ write manifest.yaml at target
```

## Risks resolution status

| Risk | Status | Phase |
|---|---|---|
| R1 — destructive `rm -rf` trong installer | Resolved (skeleton wipe) | 0 |
| R2 — awk parser fragile | Resolved (TS + zod) | 0.5 |
| R3 — `rsync -a` no cleanup | Will be resolved (manifest tracking) | 2 |
| R4 — `pinned_commit: null` | Resolved (sidecar source.commit + dependencies.yaml pinned) | 0 + 1 |
| R5 — CLAUDE.md skip-if-exists | Will be resolved (settings_patch + manifest) | 2 |
| R6 — symlink absolute path | Will be documented (INSTALL.md) | 2 |

## Non-goals

- Không publish dotclaude lên npm.
- Không thay thế upstream ECC — claudekit/ là copy có ownership, sync khi muốn.
- Không quản lý Claude Code binary install (chỉ config).
- Không auto-install external deps (npm/binary) — chỉ probe + warn.

## Plugin ecosystem references

Khi cần port pattern hoặc mở rộng kit, tham khảo (chưa adopt mặc định, đặt vào
`dependencies.yaml` với commit pinning nếu thực sự dùng):

| Repo | Mục đích |
|---|---|
| `everything-claude-code/everything-claude-code` | ECC (đã vendor — sync source) |
| `anthropics/anthropic-cookbook` | API + Claude Code patterns (docs) |
| `anthropics/skills` | Skill format reference (docs) |
| `modelcontextprotocol/servers` | MCP server collection (docs) |
| `hesreallyhim/awesome-claude-code` | Awesome list — discover tools |
| `wshobson/agents` | 100+ specialized agents để port |
| `promptfoo/promptfoo` | Eval framework cho prompts/agents |
| `jlowin/fastmcp` | Build MCP server (Python, FastAPI-style) |
| `modelcontextprotocol/typescript-sdk` | MCP TS SDK chính thức |

Evaluation checklist trước khi adopt: License compatible (MIT/Apache prefer),
maintenance active (commits 6 tháng gần), test/CI present, conform format ECC
hoặc dễ port, community signal.

## Open questions / TODO

- [ ] Phase 2 — Install pipeline.
- [ ] Phase 3 — Lifecycle (uninstall, upgrade, audit).
- [ ] Phase 4 — Marketplace + plugin packaging.
- [ ] Lockfile strategy: manifest đã 1 phần. Standalone `dependencies.lock.yaml`
      cần cho cross-machine reproducibility?
- [ ] CI: pnpm typecheck + test + schema regen verify (không drift).
- [ ] Settings.json strategy chi tiết: deep-merge với array policy (replace vs concat).
- [ ] Khi nào setup remote (GitHub) + private/public.
