# CLAUDE.md — dotclaude

Personal repo for managing Claude Code config (claudekit core + preset manifests + TS
installer). When opening Claude Code in this folder, the information below is the primary context.

## Owner & Communication

- Owner: phantien133 (phanqtien@gmail.com) — senior full-stack engineer.
- Communication: **English** for all responses, code, file names, identifiers, and commit messages.
- Keep answers concise and actionable — no need to explain basics.

## Current Status (2026-05-08)

All phases complete.

```
✓ Phase 0   — Wipe skeleton (packages/ + scripts/ bash, vendor/ → upstream/)
✓ Phase 0.5 — pnpm + TypeScript + tsx + zod + vitest bootstrap
✓ Phase 1   — claudekit/ + presets/ + 1 component vendored + validate/list/sync commands
✓ Phase 2   — Install pipeline (user symlink, project copy, manifest, deps resolver)
✓ Phase 3   — Lifecycle (uninstall, upgrade, audit)
✓ Phase 4   — Marketplace + plugin packaging (self-hosted)
```

See `docs/redesign-plan.md` Section 5 for per-phase details.

## Architecture (post-redesign)

```
dotclaude/
├── CLAUDE.md / README.md / dependencies.yaml
├── package.json + tsconfig.json + vitest.config.ts + pnpm-lock.yaml
│
├── claudekit/                      # Core kit, type-first (CQ-1a)
│   ├── agents/<n>.md + <n>.source.yaml
│   ├── skills/<n>/SKILL.md + SOURCE.yaml
│   ├── {commands,hooks,rules}/
│   ├── private/                    # GITIGNORED
│   └── private.example/            # TRACKED skeleton
│
├── presets/                        # Pure manifest (CQ-3c)
│   ├── {core,framework,purpose}/<name>.yaml + .md
│   ├── private/ + private.example/
│   └── schema/*.schema.json        # Generated from zod
│
├── plugins/                        # Phase 4
├── upstream/                       # Submodules (CQ-7) — sync_source + docs
└── scripts/                        # 100% TS via tsx (CQ-10 revised)
    ├── install.ts                  # Entry: validate | list | user | project
    ├── sync-from-upstream.ts
    ├── generate-schemas.ts
    └── lib/{schema,yaml,paths,sidecar,preset,upstream,logger}.ts
```

## Decisions from 12 CQs

Full source of truth: `docs/clarifying-questions.md` (Decisions log at end of file).

| CQ | Decision |
|---|---|
| 1a | Top-level core: `claudekit/` |
| 1b | Layout: type-first ECC style, naming prefix by domain |
| 1c | Import mode: plain copy, owner-controlled |
| 1d | Modify tracking: edit in-place + sidecar `modified` flag + `modifications` text |
| 2 | Sidecar YAML: file `<n>.source.yaml`, folder `SOURCE.yaml` (excluded on install) |
| 3a-d | Preset YAML + companion MD, folder by kind, `extends:` from Phase 1 |
| 4a-d | `private/` per top package, mirrors public, manual cloud-sync bootstrap |
| 5a-e | User+Project Phase 1, user=symlink default, project=copy default, backup-then-overwrite, idempotent MUST, manifest YAML tracking |
| 6a-c | Self-hosted marketplace (`phantien133/claudekit-marketplace`), 1-1 preset↔plugin, defer to Phase 4 |
| 7 | `vendor/` → `upstream/`, ECC role: sync_source |
| 9 | Migration: wipe & rewrite |
| 10 | 100% TS + pnpm + tsx (revised from Bun) |
| 11 | YAML for owner-controlled files, JSON for external conventions |
| 12 | Sidecar `dependencies.required/optional/external`, resolver auto-include verbose |

## Common Workflows

### New machine setup

```bash
git clone --recursive git@github.com:phantien133/dotclaude.git
cd dotclaude
pnpm install
pnpm typecheck && pnpm test
# Phase 2 (upcoming): pnpm init-private + restore private content from cloud sync
```

### Vendor a new component from upstream

```bash
# Copy file/folder
cp upstream/everything-claude-code/agents/<name>.md claudekit/agents/<name>.md

# Get pin
git -C upstream/everything-claude-code rev-parse HEAD

# Create sidecar (use another component as template)
$EDITOR claudekit/agents/<name>.source.yaml

# Verify
pnpm typecheck && pnpm test
```

See `docs/PROVENANCE.md` for sidecar schema + detailed workflow.

### Create a new preset

```bash
KIND=core; NAME=my-baseline
cp presets/core/personal-baseline.yaml presets/$KIND/$NAME.yaml
cp presets/core/personal-baseline.md   presets/$KIND/$NAME.md
$EDITOR presets/$KIND/$NAME.yaml
pnpm validate $NAME --kind $KIND
```

See `docs/PRESETS.md` for schema + authoring guide.

### Sync upstream

```bash
git submodule update --remote upstream/everything-claude-code
git -C upstream/everything-claude-code rev-parse HEAD  # update dependencies.yaml pinned_commit
pnpm sync agents/code-reviewer                         # diff per-component
# Manually merge, update sidecar.source.commit if adopting
```

### Regenerate JSON Schema

```bash
pnpm schema:generate   # idempotent, commit result to git
```

After editing `scripts/lib/schema.ts`, run this to keep JSON Schema in sync.

### Build and publish a plugin

```bash
# Build a self-contained plugin bundle for one preset
pnpm build-plugin personal-baseline --clean

# Build + update marketplace.json (local index)
pnpm publish-plugin personal-baseline --clean

# Then copy plugins/<name>/ to phantien133/claudekit-marketplace repo and push
```

Plugin output: `plugins/<preset-name>/` with `.claude-plugin/plugin.json` + component files.
No sidecar files (*.source.yaml / SOURCE.yaml) are included in the bundle.
`agents` and `hooks` are auto-discovered by Claude Code — never declared in plugin.json.

## Code Editing Principles

1. **Schema-first**: changing data shape → edit zod schema first, regen JSON Schema,
   then update consumers. Tests must pass.
2. **Sidecar sync**: editing a component in `claudekit/` → set `modified: true` +
   update `modifications:` text. Don't forget.
3. **Strict TS**: `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` in
   tsconfig — code must handle `undefined` explicitly. No arbitrary casts.
4. **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`. English headers.
5. **Commit small**: 1 commit per change — easier to revert.
6. **Verify before destructive ops**: before `git rm` / `rm -rf` / submodule deinit,
   confirm with owner — do not act unilaterally.

## Common Pitfalls

- **`pnpm list` vs `pnpm run list`**: pnpm built-in `list` takes priority. Use
  `pnpm run list` to call the preset list script.
- **Date in YAML**: js-yaml by default parses `2026-05-08` as a Date object. This repo uses
  `lib/yaml.ts` with `CORE_SCHEMA` to keep it as a string. Do not `import yaml from 'js-yaml'`
  directly — use `import { loadYaml, dumpYaml } from './lib/yaml.ts'`.
- **Sidecar path**: file-component sidecar = `<name>.source.yaml` in same dir;
  folder-component = `SOURCE.yaml` INSIDE the folder. Installer must EXCLUDE
  `SOURCE.yaml` when copying a folder to a target.

## References in Repo

- `README.md` — public quickstart
- `docs/architecture.md` — design decisions post-redesign
- `docs/redesign-plan.md` — 5-phase plan (in progress)
- `docs/clarifying-questions.md` — 12 CQs + decisions log
- `docs/PROVENANCE.md` — sidecar schema + sync workflow
- `docs/PRESETS.md` — preset schema + authoring guide
- `docs/PRIVATE.md` — private/ convention + bootstrap
- `docs/INSTALL.md` — installer usage
- `dependencies.yaml` — upstream sources (4 submodules) + pinned commits

## Plugin Ecosystem References

When porting patterns or extending the kit (verify before adopting — license, maintenance,
test/CI):

| Repo | Purpose |
|---|---|
| `everything-claude-code/everything-claude-code` | ECC — vendored (sync source) |
| `anthropics/anthropic-cookbook` | API + Claude Code patterns (docs) |
| `anthropics/skills` | Skill format reference (docs) |
| `modelcontextprotocol/servers` | MCP server collection (docs) |
| `hesreallyhim/awesome-claude-code` | Awesome list — discover tools |
| `wshobson/agents` | 100+ specialized agents to port |
| `promptfoo/promptfoo` | Eval framework for prompts/agents |
| `jlowin/fastmcp` | MCP server (Python, FastAPI-style) |
| `modelcontextprotocol/typescript-sdk` | Official MCP TypeScript SDK |

## Open Questions / TODO

- [ ] Create `phantien133/claudekit-marketplace` GitHub repo and push first plugin bundle.
- [ ] Lockfile strategy details (manifest already partially handles this).
- [ ] CI: pnpm typecheck + test + schema regen drift check.
- [ ] Settings.json deep-merge with array policy (replace vs concat per field).
- [ ] Set up remote GitHub (private/public) + push.

## Session Lineage

- 2026-05-07: skeleton (`packages/` + bash scripts) built in first session, not yet verified.
- 2026-05-08:
  - Redesign plan + 12 CQs finalized (Section 5 redesign-plan.md).
  - Phase 0 wipe skeleton (commit `d5045f7`).
  - Phase 0.5 TS+pnpm+tsx bootstrap (commit `5865a1d`).
  - Phase 1 in-progress: claudekit/agents/code-reviewer + skills/coding-standards
    vendored, presets/core/personal-baseline created, validate/list/sync subcommands
    working, 15 vitest tests pass.
