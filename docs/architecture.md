# Architecture & Design Decisions

## Goals

`dotclaude` is a personal repo that manages the **complete Claude Code kit** — an owner-controlled source of truth:

1. **`claudekit/`** — full core kit (agents, skills, commands, hooks, rules) with per-component provenance. Owner copies content from upstream, can edit it, tracks origin via sidecars.
2. **`presets/`** — pure manifests (YAML) pointing to component IDs in `claudekit/`. Contains no component code.
3. **`scripts/`** — TypeScript installer (run via tsx) reads a preset → installs into the user/project target, with manifest tracking and dependency resolution. Also handles lifecycle (uninstall, upgrade, audit) and plugin packaging.
4. **`upstream/`** — submodules (ECC + 3 docs sources) acting as sync source and docs reference; not a runtime dependency.
5. **`plugins/`** — preset → plugin bundle build artifacts, published to the Claude Code marketplace (`phantien133/dotclaude`).

## Layout

```
dotclaude/
├── CLAUDE.md
├── README.md
├── dependencies.yaml          # Upstream sources + pinned commits
├── marketplace.json           # Local marketplace index (Phase 4)
├── package.json + tsconfig.json + vitest.config.ts + pnpm-lock.yaml
│
├── claudekit/                 # Core kit (CQ-1a)
│   ├── agents/                # File-component: <name>.md + <name>.source.yaml
│   ├── skills/<name>/         # Folder-component: SKILL.md + SOURCE.yaml (+ assets)
│   ├── commands/              # File-component: <name>.md + <name>.source.yaml
│   ├── hooks/                 # File-component: <name>.sh + <name>.source.yaml
│   ├── rules/                 # File-component: <name>.md + <name>.source.yaml
│   ├── private/               # GITIGNORED (CQ-4a) — mirrors public structure
│   └── private.example/       # TRACKED skeleton, guides private/ init
│
├── presets/                   # Pure manifest (CQ-3c)
│   ├── core/<name>.yaml + .md       # cross-stack baseline
│   ├── framework/<name>.yaml + .md  # framework-specific
│   ├── purpose/<name>.yaml + .md    # task-specific
│   ├── private/                     # GITIGNORED
│   ├── private.example/             # TRACKED
│   └── schema/                      # JSON Schema generated from zod
│       ├── preset.schema.json
│       ├── sidecar.schema.json
│       └── manifest.schema.json
│
├── plugins/                   # Build artifacts for marketplace
│
├── upstream/                  # Submodules (sync source + docs)
│   ├── everything-claude-code/    role: sync_source
│   ├── anthropic-cookbook/        role: docs
│   ├── anthropic-skills/          role: docs
│   └── mcp-servers/               role: docs
│
├── scripts/                   # 100% TypeScript, tsx runner
│   ├── install.ts             # Entry: validate | list | user | project | uninstall | upgrade | audit
│   ├── sync-from-upstream.ts  # Diff sidecar.commit ↔ upstream HEAD
│   ├── generate-schemas.ts    # zod → JSON Schema
│   ├── build-plugin.ts        # Preset → plugin bundle
│   ├── publish-plugin.ts      # Build + update marketplace.json
│   ├── init-private.ts        # Copy private.example → private
│   ├── clean-backups.ts       # Remove .bak.* files
│   ├── lib/
│   │   ├── schema.ts          # zod schemas + inferred types
│   │   ├── yaml.ts            # CORE_SCHEMA loader (no auto-Date)
│   │   ├── paths.ts           # Repo + subdir resolvers
│   │   ├── sidecar.ts         # Locate + load sidecar
│   │   ├── preset.ts          # Locate + load preset
│   │   ├── resolver.ts        # extends tree + deps recursive → InstallPlan
│   │   ├── fs-ops.ts          # Symlink/copy/backup helpers
│   │   ├── manifest.ts        # Read/write .dotclaude-manifest.yaml
│   │   ├── settings-merge.ts  # Deep-merge settings_patch
│   │   ├── lifecycle.ts       # Uninstall, upgrade, audit
│   │   ├── marketplace.ts     # marketplace.json read/write
│   │   ├── plugin-build.ts    # Plugin bundle assembly
│   │   ├── upstream.ts        # dependencies.yaml lookup
│   │   └── logger.ts          # Uniform output (info/warn/error)
│   └── tests/                 # Vitest
│       ├── schema.test.ts
│       ├── resolver.test.ts
│       ├── resolver-integration.test.ts
│       ├── settings-merge.test.ts
│       ├── manifest.test.ts
│       ├── lifecycle.test.ts
│       ├── plugin-build.test.ts
│       └── preset-fixtures.test.ts
│
└── docs/
    ├── architecture.md        # This file
    ├── PROVENANCE.md          # Sidecar schema + sync workflow
    ├── PRESETS.md             # Preset schema + authoring guide
    ├── PRIVATE.md             # private/ convention + bootstrap
    └── INSTALL.md             # Installer usage
```

## Key decisions (settled through 12 CQs)

| # | Decision | Reference |
|---|---|---|
| CQ-1a | Top-level core: `claudekit/` (explicit, brandable) | |
| CQ-1b | Type-first layout (ECC style). Domain prefix naming: `web-`, `python-`, `go-` etc. for domain-specific; cross-stack components keep original name (e.g. `code-reviewer`) | |
| CQ-1c | Import mode: plain copy — owner controls content | |
| CQ-1d | Modify tracking: edit in place + sidecar `modified` flag | |
| CQ-2 | Sidecar YAML — file-component `<name>.source.yaml`, folder-component `SOURCE.yaml` (excluded on install) | docs/PROVENANCE.md |
| CQ-3a/b/c/d | Preset: YAML + companion MD, schema validation via `# yaml-language-server: $schema=...` header, folder per kind, `extends:` supported | docs/PRESETS.md |
| CQ-4a/b/c/d | `private/` per top package, mirrors public, `private.example/` skeleton tracked, manual cloud-sync bootstrap | docs/PRIVATE.md |
| CQ-5a/b/c/d/e | User+Project install; neither scope has a hardcoded default mode — installer always prompts `symlink/copy` when no flag is passed. Pass `--symlink` or `--copy` to skip prompt. Folder components respect the chosen mode (copy uses `copyFolderExcluding`, excludes `SOURCE.yaml`). Backup-then-overwrite; idempotent; manifest YAML tracking | docs/INSTALL.md |
| CQ-6 | Claude Code marketplace (`dotclaude`, served from `phantien133/dotclaude`), 1-1 preset↔plugin | |
| CQ-7 | `vendor/` → `upstream/`, ECC role: sync_source | |
| CQ-10 | 100% TS + pnpm + tsx | |
| CQ-11 | YAML for owner-controlled files; JSON for external conventions (settings.json, package.json, JSON Schema, plugin manifest) | |
| CQ-12 | Sidecar has `dependencies.required/optional/external`; resolver auto-includes required, skips optional by default, warn-only for external | docs/PROVENANCE.md |
| CQ-13 | Sidecar has `tags: string[]` (flat labels) + `categories: Record<string, string[]>` (grouped by dimension: purpose, stack, mechanism, phase…). Both default to empty and are optional at vendor time. Intended for future preset wizard / search tooling | docs/PROVENANCE.md |

## Resolver flow

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
  ↓ apply via fs-ops (symlink/copy with backup)
  ↓ write manifest.yaml at target
```

## Plugin build flow

```
pnpm build-plugin <preset-name>
  ↓ resolver → InstallPlan (no fs writes)
  ↓ copy component files into plugins/<name>/ (no sidecar files)
  ↓ write .claude-plugin/plugin.json
  ↓ agents + hooks: auto-discovered by Claude Code (not declared in plugin.json)

pnpm publish-plugin <preset-name>
  ↓ build-plugin steps
  ↓ update marketplace.json with new entry
  ↓ (manual) commit plugins/<name>/ + push to marketplace remote
```

## Non-goals

- Do not publish dotclaude to npm.
- Do not replace upstream ECC — `claudekit/` is an owned copy, synced on demand.
- Do not manage Claude Code binary installation (config only).
- Do not auto-install external deps (npm/binary) — probe and warn only.

## Plugin ecosystem references

| Repo | Purpose |
|---|---|
| `everything-claude-code/everything-claude-code` | ECC (vendored — sync source) |
| `anthropics/anthropic-cookbook` | API + Claude Code patterns (docs) |
| `anthropics/skills` | Skill format reference (docs) |
| `modelcontextprotocol/servers` | MCP server collection (docs) |
| `hesreallyhim/awesome-claude-code` | Awesome list — discover tools |
| `wshobson/agents` | 100+ specialized agents to port |
| `promptfoo/promptfoo` | Eval framework for prompts/agents |
| `jlowin/fastmcp` | Build MCP servers (Python, FastAPI-style) |
| `modelcontextprotocol/typescript-sdk` | Official MCP TypeScript SDK |

Evaluation checklist before adopting: license compatible (MIT/Apache preferred), maintenance active, test/CI present, conforms to ECC format or easy to port, positive community signal.

