# Architecture & Design Decisions

> Updated 2026-05-08 after Phase 0 + Phase 1 redesign. The skeleton model
> (`packages/` + bash installer) has been wiped (see `redesign-plan.md` Section 5.2).

## Goals after redesign

`dotclaude` is a personal repo that manages the **complete Claude Code kit** — not just
a wrapper around upstream, but an owner-controlled source of truth:

1. **`claudekit/`** — full core kit (agents, skills, commands, hooks, rules) with
   per-component provenance. Owner copies content from upstream, can edit it, and tracks
   origin via sidecars.
2. **`presets/`** — pure manifests (YAML) pointing to component IDs in `claudekit/`.
   Contains no component code.
3. **`scripts/`** — TypeScript installer (run via tsx) reads a preset → installs into
   the user/project target, with manifest tracking and dependency resolution.
4. **`upstream/`** — submodules (ECC + 3 docs sources) acting as sync source and
   docs reference; NO LONGER a runtime dependency.
5. **`plugins/`** — placeholder for Phase 4 (preset → plugin bundle, publish to
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
├── plugins/                   # Phase 4 build artifacts (empty until Phase 4)
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
    ├── architecture.md        # This file
    ├── redesign-plan.md       # 5-phase plan (in progress)
    ├── clarifying-questions.md  # Decisions log for 12 CQs
    ├── PROVENANCE.md          # Sidecar schema + sync workflow
    ├── PRESETS.md             # Preset schema + authoring guide
    ├── PRIVATE.md             # private/ convention + bootstrap
    └── INSTALL.md             # Installer usage
```

## Key decisions (settled through 12 CQs)

| # | Decision | Reference |
|---|---|---|
| CQ-1a | Top-level core: `claudekit/` (explicit, brandable) | clarifying-questions.md |
| CQ-1b | Internal layout: type-first (ECC style), domain naming prefix `web-`, `python-`, ... | |
| CQ-1c | Import mode: plain copy — owner controls content | |
| CQ-1d | Modify tracking: edit in place + sidecar `modified` flag | |
| CQ-2 | Sidecar YAML — file-component `<name>.source.yaml`, folder-component `SOURCE.yaml` (excluded on install) | docs/PROVENANCE.md |
| CQ-3a/b/c/d | Preset: YAML + companion MD, schema validation via `# yaml-language-server: $schema=...` header, folder per kind, `extends:` from Phase 1 | docs/PRESETS.md |
| CQ-4a/b/c/d | `private/` per top package, mirrors public, `private.example/` skeleton tracked, manual cloud-sync bootstrap | docs/PRIVATE.md |
| CQ-5a/b/c/d/e | User+Project Phase 1; user=symlink default, project=copy default; backup-then-overwrite; idempotent MUST; manifest YAML tracking | docs/INSTALL.md |
| CQ-6 | Self-hosted marketplace (`phantien133/claudekit-marketplace`), 1-1 preset↔plugin, deferred to Phase 4 | redesign-plan.md §5.6 |
| CQ-7 | `vendor/` → `upstream/`, ECC role: sync_source | |
| CQ-9 | Migration: wipe & rewrite (no migration of old skeleton) | |
| CQ-10 | 100% TS + pnpm + tsx (revised from Bun due to toolchain) | |
| CQ-11 | YAML for owner-controlled files; JSON for external conventions (settings.json, package.json, JSON Schema, plugin manifest) | |
| CQ-12 | Sidecar has `dependencies.required/optional/external`; resolver auto-includes required, skips optional by default, warn-only for external | docs/PROVENANCE.md |

## Resolver flow (Phase 2 will implement fully)

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

## Risks resolution status

| Risk | Status | Phase |
|---|---|---|
| R1 — destructive `rm -rf` in installer | Resolved (skeleton wipe) | 0 |
| R2 — awk parser fragile | Resolved (TS + zod) | 0.5 |
| R3 — `rsync -a` no cleanup | Will be resolved (manifest tracking) | 2 |
| R4 — `pinned_commit: null` | Resolved (sidecar source.commit + dependencies.yaml pinned) | 0 + 1 |
| R5 — CLAUDE.md skip-if-exists | Will be resolved (settings_patch + manifest) | 2 |
| R6 — symlink absolute path | Will be documented (INSTALL.md) | 2 |

## Non-goals

- Do not publish dotclaude to npm.
- Do not replace upstream ECC — `claudekit/` is an owned copy, synced on demand.
- Do not manage Claude Code binary installation (config only).
- Do not auto-install external deps (npm/binary) — probe and warn only.

## Plugin ecosystem references

When porting patterns or extending the kit, refer to the following (not adopted by default;
add to `dependencies.yaml` with commit pinning if actually used):

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

Evaluation checklist before adopting: license compatible (MIT/Apache preferred),
maintenance active (commits within 6 months), test/CI present, conforms to ECC format
or easy to port, positive community signal.

## Open questions / TODO

- [ ] Phase 2 — Install pipeline.
- [ ] Phase 3 — Lifecycle (uninstall, upgrade, audit).
- [ ] Phase 4 — Marketplace + plugin packaging.
- [ ] Lockfile strategy: manifest partially covers this. Is a standalone `dependencies.lock.yaml`
      needed for cross-machine reproducibility?
- [ ] CI: pnpm typecheck + test + schema regen verification (prevent drift).
- [ ] Detailed settings.json strategy: deep-merge with array policy (replace vs concat).
- [ ] When to set up remote (GitHub) + private/public split.
