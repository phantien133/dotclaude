# Clarifying Questions — Redesign

> Questions for the owner to answer before generating the full plan in [redesign-plan.md](./redesign-plan.md).
>
> Each CQ specifies: **Problem** (what needs to be decided), **Why** (why it matters),
> **Options** (choices + trade-offs), **Recommendation** (suggested approach if any), **Status**.
>
> Status: `pending` (not asked) / `asking` (in progress) / `answered` (decided) / `blocked` (waiting on another CQ).

Workflow: ask each CQ one at a time using AskUserQuestion. When answered → record the answer + brief rationale in that CQ's `Decision`. When complete → generate the plan in `redesign-plan.md`.

---

## CQ-1 — Core layout

Related: REQ-1 (claudekit core bundle).

### CQ-1a — Top-level name + location of core

**Problem**: Where does the core kit live in the repo, and what is it called?

**Why**: Name + location affects all import paths, script paths, docs, and plugin manifests. Renaming later is costly.

**Options**:
- **A. `core/`** — short, at root.
- **B. `kit/`** — shorter, generic.
- **C. `claudekit/`** — explicit, brandable, matches what the owner calls it.
- **D. `packages/core/`** — preserves the monorepo pattern from the current skeleton.

**Trade-off**: A/B/C are flat at root, easy to navigate, suitable when presets/plugins are also flat.
D fits if the repo will have many independent "packages" later. The owner said presets are pure manifests → hard to call them true "packages" → flat at root seems more appropriate.

**Recommendation**: A (`core/`) — short, clear, fits the flat pattern alongside `presets/` + `plugins/`.

**Status**: answered (2026-05-07)

**Decision**: **C — `claudekit/`**. Top-level layout: `claudekit/ + presets/ + plugins/ + scripts/`. The owner preferred explicit/brandable over brevity. All paths going forward use `claudekit/<type>/<name>` as the canonical reference.

---

### CQ-1b — Internal structure of core

**Problem**: How to group components inside core: flat by type, grouped by domain, or hybrid?

**Why**: This determines how presets reference components (flat ID vs namespaced ID) and how the repo scales when many domains (web/python/go/...) are added.

**Options**:
- **A. Type-first** (like ECC): `core/agents/`, `core/skills/`, `core/commands/`,
  `core/hooks/`, `core/rules/`. Components referenced by flat ID (`code-reviewer`,
  `coding-standards`).
- **B. Domain-first**: `core/web/{agents,skills}/`, `core/python/{agents,skills}/`,
  `core/common/{agents,skills}/`. References require namespace (`web/coding-standards`).
- **C. Hybrid**: top-level type, sub-folder domain inside (`core/skills/web/`,
  `core/skills/python/`, `core/agents/common/`).

**Trade-off**: A is simple but name collisions across domains are possible. B mirrors rule sets nicely but presets must use long namespaced references. C balances — type is the primary Claude concept (matching `~/.claude/{agents,skills,commands,hooks}` convention), domain is a secondary detail → install still flattens to `~/.claude/agents/<name>.md`.

**Recommendation**: C (Hybrid) because it matches Claude's install convention (top-level type) while still grouping by domain in the source repo. But if the owner is comfortable with ECC's pattern A and naming discipline with prefixes (`web-coding-standards`, `python-coding-standards`), A works too.

**Status**: answered (2026-05-07)

**Decision**: **A — Type-first (ECC style)**. Flat by type, naming prefixes (`web-`, `python-`, `go-`, ...) to avoid collisions. The convention will be documented in the repo's style guide. Rationale: familiar ECC pattern, simple single-level installer, flat preset reference IDs are easy to read.

**Implications**:
- A naming-prefix style guide is needed when importing domain-specific components.
- Cross-stack components: keep original name, no prefix (e.g. `code-reviewer`).
- When only one version of a component exists in the repo → no prefix needed.

---

### CQ-1c — Copy into core vs symlink/submodule keeping upstream

**Problem**: When importing a component from ECC/anthropic-skills into core, copy the content into the dotclaude repo or keep a submodule + symlink?

**Why**: The owner wrote "**own the content**" and "can clone with modifications" → likely copy. But needs confirmation because copying means losing the upstream auto-update link.

**Options**:
- **A. Copy files into `core/`**, store source metadata separately. Updates are manual (re-pull upstream, diff, cherry-pick).
- **B. Keep submodule in `vendor/`, symlink into `core/`**. Updates only need `git submodule update --remote`. But modifying a component breaks the symlink.
- **C. Hybrid**: copy for components that need modification, symlink for components used as-is.

**Trade-off**: A gives full ownership + freedom to modify, at the cost of sync responsibility. B auto-updates but modifications are not possible. C is complex, two mechanisms in parallel.

**Recommendation**: A — the owner has stated "own the content" and is willing to modify. The submodule is kept only as a read reference for syncing (not a runtime dependency).

**Status**: answered (2026-05-07)

**Decision**: **A — Pure copy**. `claudekit/` is the source of truth. Provenance stored in sidecar `<name>.source.json` (original commit, modified flag, ...). A `scripts/sync-from-upstream.sh` script is needed to pull upstream → diff → let the owner decide merge/skip.

**Implications**:
- Vendor/upstream submodule kept as a "source for diffing", not a runtime dependency (confirmed further in CQ-7).
- No symlinks in `claudekit/` → portable cross-machine, no dependency on absolute paths.

---

### CQ-1d — How to handle modifying vendored components

**Problem**: When a component is cloned and then modified, how to track the diff against upstream so future updates can be merged?

**Why**: If upstream modifies the same section → conflict. Need to know which parts were modified.

**Options**:
- **A. Patch file**: store a `.patch` in `core/<type>/<name>.patch`, original file unchanged, apply patch during install. Updates = re-apply patch on new upstream.
- **B. Edit directly + diff in metadata**: modify file directly, metadata records `modified: true` + summary. When syncing upstream, run `git diff` manually.
- **C. Per-component branch**: each modified component is a branch in dotclaude tracking its upstream. Complex, not recommended.

**Trade-off**: A is clean and easy to rebase, but harder to read/edit. B is simple and easy to edit, but requires manual bookkeeping. C is overkill for a personal repo.

**Recommendation**: B — pragmatic for a personal repo. The sidecar metadata already tracks source + original commit + modified flag; that is sufficient. Option A only becomes necessary when upstream changes frequently.

**Status**: answered (2026-05-07)

**Decision**: **B — Edit directly + sidecar flag**. Files in `claudekit/` are the actual used files. Sidecar records `modified: bool` + `modifications: <text>`. Sync workflow uses `git diff <source_commit>..upstream <source_path>` to show the diff; the owner decides which parts to merge manually.

**Implications**:
- Sidecar must have an accurate `source_commit` field for diffs to work.
- When modifying, the owner must remember to update the `modifications` field (a PostToolUse hook on the sidecar's directory could remind).
- No separate snapshot needed — git history of the upstream submodule is sufficient.

---

## CQ-2 — Provenance metadata format

Related: REQ-1.

**Problem**: Where and in what format should the upstream source of each component be recorded?

**Why**: The owner requires "**a separate note file per component**" → need a consistent format that installer/scripts can read and humans can understand.

**Options**:
- **A. Per-file frontmatter**: add a `source:` field to the existing YAML frontmatter of agent/skill/command. Only works for `.md` files with frontmatter. Hooks (JSON) + commands have no frontmatter → inconsistent.
- **B. Sidecar file**: each component has a `<name>.source.json` file alongside it (e.g. `core/agents/code-reviewer.md` + `core/agents/code-reviewer.source.json`). Consistent format, covers all file types. Trade-off: doubles the file count.
- **C. Centralized manifest**: a single `core/PROVENANCE.json` listing everything. Easy to scan but prone to drift when files are edited without updating the manifest.
- **D. Hybrid B+C**: per-file sidecar (source of truth), one generated summary manifest (read-only).

**Recommendation**: B (sidecar) — the owner explicitly said "separate per component" → a per-component source file matches the intent. D can be added later if fast lookup is needed.

**Status**: answered (2026-05-07)

**Decision**: **Sidecar YAML**, with layout differentiated by component type:
- File-component (agent/command/hook/rule, one file per component): sidecar `<name>.source.yaml` alongside the file. E.g. `claudekit/agents/code-reviewer.md` + `claudekit/agents/code-reviewer.source.yaml`.
- Folder-component (skill, one folder per component): sidecar `SOURCE.yaml` **inside** the skill folder. E.g. `claudekit/skills/coding-standards/{SKILL.md, assets/, SOURCE.yaml}`. The installer must **exclude `SOURCE.yaml`** when copying the folder to a target.

**Fields**:
```yaml
source:
  repo: https://github.com/affaan-m/everything-claude-code
  commit: abc123def456
  path: agents/code-reviewer.md
  ref: main
imported_at: 2026-05-07
license: MIT
modified: false
modifications: null   # text description when modified: true
notes: null
```

**Implications**:
- Requires a YAML parser (yq or Python/Node) → installer can no longer be pure-bash awk like the old skeleton. This trade-off is accepted.
- When copying a skill folder, installer must use `rsync --exclude=SOURCE.yaml` or a manual filter.
- An index file `claudekit/MANIFEST.yaml` generated from all sidecars could be added (Phase 2 if fast lookup is needed).

---

## CQ-3 — Preset format & schema

Related: REQ-2.

### CQ-3a — JSON schema for preset

**Problem**: What fields should a preset JSON contain?

**Proposed**:
```json
{
  "name": "typescript-fullstack",
  "kind": "framework",
  "description": "Next.js + Node + Postgres TS preset",
  "extends": ["base-typescript"],
  "components": {
    "agents": ["code-reviewer", "tdd-guide"],
    "skills": ["coding-standards", "frontend-patterns"],
    "commands": [],
    "hooks": [],
    "rules": []
  },
  "settings_patch": {
    "allowedTools": ["..."]
  },
  "version": "0.1.0"
}
```

**Status**: answered (2026-05-07)

**Decision** — Phase 1 schema (revised 2026-05-07: format switched from JSON → YAML for easier hand-editing):
```yaml
# yaml-language-server: $schema=../../schema/preset.schema.json
name: typescript-fullstack
kind: framework  # framework | core | purpose
description: ...
version: 0.1.0
extends: []
components:
  agents: []
  skills: []
  commands: []
  hooks: []
  rules: []
settings_patch: {}
tags: []
```

**Format note**: the schema file `preset.schema.json` remains JSON Schema (cross-IDE standard).
Preset YAML uses the header comment `# yaml-language-server: $schema=...` so the VS Code YAML extension validates it.

Fields included:
- `target_levels`: **NO**. The owner manages the appropriate level manually.
- `settings_patch`: **YES**. JSON snippet deep-merged into the target `settings.json`. Installer must implement deep-merge + conflict policy.
- `mcp_servers`: **defer Phase 2**. Phase 1 does not pull MCP via preset.
- `extends`: **YES immediately** (see CQ-3b below).
- `tags`: **YES**. String array for filtering (`claudekit list --tag fullstack`).

### CQ-3b — `extends:` now or Phase 2?

**Problem**: Implement inheritance between presets in the initial redesign, or defer?

**Trade-off**: Implement now → more complex schema, but avoids later refactoring. Defer → faster initial phase, simpler schema.

**Status**: answered (2026-05-07)

**Decision**: **Include immediately**. Field `extends: [<preset-name>, ...]` from Phase 1.

**Edge cases to handle during implementation** (noted for the plan):
- Multiple inheritance: `extends: ["base-typescript", "base-postgres"]` → merge tree.
- Diamond inheritance: A→B, A→C, B→D, C→D → avoid applying D twice.
- Circular dependency: detect + abort with a clear error.
- Component conflict: two parents both list `code-reviewer` → idempotent, OK; two parents have `settings_patch` with the same key but different values → conflict, needs policy (last-wins / error).
- Override / exclude: can a child "remove" a component from a parent? Phase 1 proposal: NO (append only), keeping the schema simple. The owner can reconsider when a real use case arises.

**Status**: answered (2026-05-07)

### CQ-3c — Classification by `kind` (framework/core/purpose)

**Problem**: Should the framework/core/purpose axis live in the `kind` field (flat `presets/`), or in separate folders (`presets/framework/`, `presets/core/`, `presets/purpose/`)?

**Trade-off**: `kind` field flat — easy to scan, less navigation. Folders — cleaner when there are many presets, but longer paths.

**Recommendation**: Flat `presets/<name>.json` + `kind` field — simple, easy to list. Folder grouping only when there are many presets (>20).

**Status**: answered (2026-05-07)

**Decision**: **Folder by kind**. Layout:
```
presets/
├── core/
├── framework/
├── purpose/
└── README.md
```
The canonical path of a preset is `presets/<kind>/<name>.json`. The `kind` field in JSON is kept (redundant with the path but needed for schema validation + extends references).

**Implications**:
- Changing kind = `mv` the file between folders.
- Extends reference: exact behavior to be finalized during implementation (name-only auto-search vs qualified `core/base-typescript`).

### CQ-3d — Markdown alongside JSON

**Problem**: Does each preset need a `.md` alongside the `.json`, and what is its role?

**Options**:
- **A. JSON only**: installer-readable, shared README at `presets/README.md`.
- **B. JSON + MD**: JSON for installer, MD for human docs (rationale, when to use).
- **C. MD with frontmatter + body**: single file, frontmatter equivalent to JSON, body is docs. Installer reads frontmatter.

**Recommendation**: C — single `<name>.md` with YAML frontmatter. Matches Claude convention (agents/skills also use frontmatter + body). Installer parses frontmatter (JSON or YAML).

**Status**: answered (2026-05-07)

**Decision** (revised 2026-05-07: JSON → YAML): **YAML + MD per preset**. Each preset has two files with the same name but different extensions:
```
presets/<kind>/<name>.yaml   # installer reads this, schema-validated via zod + JSON Schema
presets/<kind>/<name>.md     # human docs: when to use, rationale, examples
```

The installer only reads YAML via `js-yaml` + zod. MD is docs only. File names must be 1-1 in sync (a lint script verifies). The owner rejected the "frontmatter MD" option to keep machine vs human files clearly separated.

---

## CQ-4 — `private/` placement

Related: REQ-3.

### CQ-4a — Which level for `private/`?

**Problem**: "Each section has a private folder" — which level is a "section"?

**Options**:
- **A. Root**: one `private/` folder at root, mirroring the full structure (`private/core/agents/...`, `private/presets/...`).
- **B. Per package**: `core/private/`, `presets/private/`, `plugins/private/`.
- **C. Per component type**: `core/agents/private/`, `core/skills/private/`, ...
  Deepest mirroring.

**Trade-off**: A — one place to gitignore, easy git, clear to scan. B — close to components but requires remembering multiple ignore rules. C — closest to files but modifies the structure of each type.

**Recommendation**: A. One gitignore rule (`/private/`) covers everything. Installer scans `private/<mirror-path>` in parallel with public path. Simplest when growing.

**Status**: answered (2026-05-07)

**Decision**: **B — `private/` under each top-level package**. Layout:
```
claudekit/private/   (gitignored)
presets/private/     (gitignored)
plugins/private/     (gitignored, later)
```
Each gitignore rule declared separately.

### CQ-4b — Structure inside `private/`

**Problem**: Should `private/` mirror the public structure (e.g. `private/core/agents/foo.md`) or be free-form?

**Recommendation**: Mirror — the installer uses the same logic, just swaps the base path. Free-form leads to ad-hoc structures that are hard to automate.

**Status**: answered (2026-05-07)

**Decision**: **Mirror public**. `claudekit/private/{agents,skills,commands,hooks,rules}/`
+ `presets/private/{core,framework,purpose}/`. When resolving a component ID, installer searches the public path first, then falls back to the private path. Presets reference private components by flat ID.

### CQ-4c — `private.example/` template

**Problem**: Is a `private.example/` directory (tracked in git, with examples) needed to guide repo cloners on how to use `private/`?

**Trade-off**: Yes — new contributors know how to initialize. No — it's a personal repo, the owner already knows.

**Recommendation**: Yes, but minimal. One `private/.gitkeep` + `private.example/README.md` explaining the convention. Useful when open-sourcing or sharing.

**Status**: answered (2026-05-07)

**Decision**: **Yes, `private.example/`** at each top-level package. Minimal skeleton:
```
claudekit/private.example/
├── README.md         # explains convention + example use cases
└── agents/.gitkeep   # mirror skeleton
presets/private.example/
├── README.md
└── framework/.gitkeep
```
+ `scripts/init-private.sh` copies all `private.example/` → `private/` for new machines.

### CQ-4d — Multi-machine bootstrap for `private/`

**Problem**: `private/` is not tracked in git → when setting up a new machine, where does the content come from?

**Options**:
- **A. Manual copy** (USB / cloud sync / 1Password file).
- **B. Separate private repo** `dotclaude-private` → clone into `private/`.
- **C. Symlink from the owner's existing dotfiles repo**.
- **D. Don't worry about it, solve later**.

**Recommendation**: B — clean separation, version-controlled, easy to rotate. Either submodule or manual git clone works.

**Status**: answered (2026-05-07)

**Decision**: **A — Manual copy / cloud sync**. The owner syncs private content via their own preferred medium (iCloud/Dropbox/USB/1Password). The dotclaude repo does NOT manage distribution. `docs/PRIVATE.md` documents the convention and backup reminder.

**Implications**: no submodule for private, no auto-sync script. If the owner wants versioning later, refactor to option B.

---

## CQ-5 — Install levels & semantics

Related: REQ-4.

### CQ-5a — Levels to support

**Problem**: Which levels should the initial phase cover?

**Levels per Claude convention**:
- User: `~/.claude/{agents,skills,commands,hooks/scripts}/`, `~/.claude/settings.json`,
  `~/.claude.json` (MCP).
- Project: `<repo>/.claude/...`, `<repo>/.mcp.json`, `<repo>/CLAUDE.md`.
- Plugin: `~/.claude/plugins/<name>/...` (Claude plugin model).
- Plugin marketplace: `~/.claude/plugins.json` or command `/plugin install`.

**Options**:
- **A. Phase 1: user + project only**, plugin/marketplace in a later phase.
- **B. Cover all immediately**, high complexity.

**Recommendation**: A — Phase 1 user + project (covers most use cases). Plugin/marketplace addressed in CQ-6 and a later phase.

**Status**: answered (2026-05-07)

**Decision**: **A — User + Project only**. Phase 1 covers `~/.claude/` + `<repo>/.claude/`. Plugin/MCP deferred.

### CQ-5b — Copy vs symlink default

**Problem**: What is the default action when installing — copy or symlink?

**Options**:
- **A. Copy default**: `--symlink` flag to override. Safe, no dependency on dotclaude path. But edits to core are not reflected automatically.
- **B. Symlink default**: `--copy` flag. Core edits apply automatically. Depends on absolute path.
- **C. Hybrid by target**: user level symlinks (dev workflow), project level copies (project standalone, committable `.claude/`).

**Recommendation**: C — matches actual usage. User (personal) benefits from live links. Project copies allow sharing with teammates / CI without needing dotclaude.

**Status**: answered (2026-05-07)

**Decision**: **C — Hybrid**. User level defaults to symlink, project level defaults to copy. Flags `--copy` / `--symlink` override. When symlinking, the absolute path to `/<dotclaude-root>/claudekit/...` is stored.

### CQ-5c — Conflict policy

**Problem**: How to handle a file that already exists at the target?

**Options**:
- **A. Skip with warning**: safe, does not destroy.
- **B. Overwrite**: idempotent re-run, but destroys user's manual edits.
- **C. Backup-then-overwrite**: creates `<file>.bak`, safe + re-run OK.
- **D. Interactive prompt**: slow, not scriptable.

**Recommendation**: C default + `--force` flag (skip backup) + `--skip-existing`.

**Status**: answered (2026-05-07)

**Decision**: **Backup-then-overwrite default**. Backup naming: `<file>.bak.<YYYYMMDD-HHMMSS>` to avoid collisions. Flags:
- `--force`: overwrite without backup (clean idempotent re-run)
- `--skip-existing`: skip files that already exist
- `--prompt`: ask y/n per file

A `scripts/clean-backups.sh` script removes `.bak.*` files older than N days.

### CQ-5d — Idempotent + uninstall

**Problem**: Running install a second time must be safe (idempotent). Is `uninstall` needed?

**Recommendation**: Idempotent is a MUST. Uninstall — nice-to-have in Phase 2 (requires manifest tracking from CQ-5e first).

**Status**: answered (2026-05-07)

**Decision**: Idempotent **MUST** in Phase 1. Uninstall **defer to Phase 2**.

### CQ-5e — Install manifest tracking

**Problem**: Is it necessary to record "what files this install placed where" so uninstall/diff/upgrade know the state?

**Options**:
- **A. Yes**: a `~/.claude/.dotclaude-manifest.json` file (or per-target). Lists installed files, source preset, version, timestamp.
- **B. No**: stateless, each install is a full replace. Simpler but cleanup is difficult.

**Recommendation**: A. Required for smart uninstall + upgrade + audit. Worth doing in Phase 1.

**Status**: answered (2026-05-07)

**Decision** (revised 2026-05-07: JSON → YAML): **A — Include manifest from Phase 1**. Files:
- User: `~/.claude/.dotclaude-manifest.yaml`
- Project: `<repo>/.claude/.dotclaude-manifest.yaml`

Preliminary schema:
```yaml
schema_version: 1
installed_at: 2026-05-07T14:30:12Z
presets:
  - name: typescript-fullstack
    version: 0.1.0
    kind: framework
components:
  - type: agent
    id: code-reviewer
    target_path: ~/.claude/agents/code-reviewer.md
    mode: symlink
    source_path: /path/to/dotclaude/claudekit/agents/code-reviewer.md
    source_commit: abc123
    preset: typescript-fullstack
    auto_included: false      # explicit in preset.components
    required_by: []
  - type: skill
    id: coding-standards
    target_path: ~/.claude/skills/coding-standards/
    mode: symlink
    source_path: /path/to/dotclaude/claudekit/skills/coding-standards/
    source_commit: abc123
    preset: typescript-fullstack
    auto_included: true       # pulled in via dependency, not listed in preset
    required_by:
      - "agent:code-reviewer"
settings_patches:
  - preset: typescript-fullstack
    patch_keys:
      - hooks.PostToolUse[0]
external_deps:
  - name: prettier
    type: npm
    version_required: ">=3.0"
    found: false
    requested_by:
      - "hook:format-on-save"
```

**Edge cases for the plan**:
- Multiple presets overlapping (preset A and B both install code-reviewer): manifest stores a `presets` array per component.
- Reinstall: manifest is updated, not duplicated.
- Files at target not in manifest: audit command lists them for the owner to decide.

---

## CQ-6 — Marketplace & plugin

Related: REQ-5.

### CQ-6a — Marketplace target

**Status**: answered (2026-05-07)

**Decision**: **B — Self-hosted marketplace**. A separate repo `phantien133/claudekit-marketplace` containing a `marketplace.json` index + `plugins/` folder. Users add it once via `/plugin marketplace add phantien133/claudekit-marketplace`, then install with `/plugin install <name>`.

### CQ-6b — Preset ↔ plugin relationship

**Status**: answered (2026-05-07)

**Decision**: **A — 1-1**. Each preset = one standalone plugin. Build pipeline: preset JSON → resolve all components (including via extends) → package plugin. Duplicate components across plugins are acceptable as a trade-off for simplicity (each plugin is self-contained).

### CQ-6c — Phase

**Status**: answered (2026-05-07)

**Decision**: **A — Last phase**. Done after core + presets + user/project install are stable and at least 1-2 real presets exist. Before building the plugin pipeline, verify the current Claude plugin model (read latest Anthropic docs + everything-claude-code + cookbook to understand manifest format and marketplace behavior).

---

## CQ-7 — Vendor strategy post-redesign

Related: REQ-1, R4.

**Problem**: After core becomes an owned copy, does `vendor/` still exist and in what role?

**Options**:
- **A. Remove the runtime submodule** (everything-claude-code), keep the other 3 as docs in a different directory (e.g. `references/` instead of `vendor/`).
- **B. Keep ECC submodule as "sync source"**: used to diff/pull when updating core. Not a runtime dependency.
- **C. Remove all submodules**, just link to upstream in docs when inspection is needed.

**Recommendation**: B + rename `vendor/` → `upstream/` to clarify semantics (no longer a vendored runtime).

**Status**: answered (2026-05-07)

**Decision**: **A — Rename `vendor/` → `upstream/`**. Keep all 4 submodules in the same folder (everything-claude-code, anthropic-cookbook, anthropic-skills, mcp-servers). ECC's role changes from runtime → "source for syncing" for `scripts/sync-from-upstream.sh`. The other 3 are docs references. The name `upstream/` accurately reflects the semantics.

---

## CQ-8 — Phase ordering

**Problem**: How to split the plan into phases, and what to build first?

**Status**: answered (2026-05-07)

**Decision** — 5 main phases:

- **Phase 0**: Clean up skeleton (wipe `packages/` + `scripts/`, rename `vendor/` → `upstream/`).
- **Phase 1**: Core foundation. `claudekit/` layout (type-first), sidecar provenance, presets layout (folder by kind, JSON+MD), `private.example/`, 1 real component from ECC + 1 real preset, sync-from-upstream script, `docs/PRIVATE.md`.
- **Phase 2**: Install pipeline (user symlink + project copy, backup-then-overwrite, manifest tracking, settings_patch deep-merge, extends resolver, init-private).
- **Phase 3**: Lifecycle (uninstall, upgrade, clean-backups).
- **Phase 4**: Marketplace + plugin (verify Claude plugin model, build-plugin, claudekit-marketplace repo, publish flow).

**Phase 5+ deferred**: mcp_servers, plugin level install, target_levels, extends override/exclude, tag filter command.

---

## CQ-10 — Implementation language for scripts

Related: REQ-4 (install scripts), R2 (fragile parser).

**Problem**: Should scripts be written in Bash, TypeScript, Python, or a hybrid?

**Pain points of Bash for dotclaude**:
- YAML parsing requires `yq` (external Go binary).
- JSON Schema validation requires shelling out.
- Deep-merging JSON with conflict policy is complex.
- Resolving the `extends` tree (CQ-3b) → recursive bash + dedupe + circular detection is painful.
- Cross-platform: macOS BSD vs Linux GNU differ (`sed -i`, `realpath`, `mktemp`).
- Weak test frameworks (bats/shunit2 are heavy).

**TypeScript + Bun advantages**:
- Mature libraries: `zod`, `js-yaml`, `ajv`, `deepmerge`, `commander`.
- Type-safe schemas (preset/manifest/sidecar) → catches errors at compile time + IDE autocomplete.
- Naturally cross-platform.
- Easy to test with Vitest + fs mocks.
- Owner has full-stack TS background → no learning curve.
- Bun shebang `#!/usr/bin/env bun` runs `.ts` files directly.

**Status**: answered (2026-05-07), revised (2026-05-08)

**Decision** (revised 2026-05-08): **A — 100% TypeScript + pnpm + tsx**. The original decision was Bun, but at Phase 0.5 the owner did not have Bun installed and Homebrew did not have an official formula (only via curl-pipe-bash or a third-party cask). The available toolchain — node 23.7 + pnpm 10.28 — was switched to `pnpm` (package manager) + `tsx` (TS runner), achieving the same goals without requiring an extra system install. If the owner installs Bun later, this can be revisited (Bun runs tsx-style scripts directly; migrating the shebang from `#!/usr/bin/env tsx` to `#!/usr/bin/env bun` is trivial).

**Layout**:
```
scripts/
├── install.ts                  # entry, commander
├── install-user.ts
├── install-project.ts
├── sync-from-upstream.ts
├── init-private.ts
├── clean-backups.ts
├── lib/
│   ├── schema.ts               # zod schemas (preset, sidecar, manifest)
│   ├── resolver.ts             # extends resolver, component lookup
│   ├── manifest.ts             # read/write .dotclaude-manifest.yaml
│   ├── settings-merge.ts       # deep-merge JSON
│   ├── sidecar.ts              # parse SOURCE.yaml + <name>.source.yaml
│   ├── fs-ops.ts               # symlink/copy/backup helpers
│   └── logger.ts               # uniform output
└── tests/
    └── *.test.ts               # Vitest
package.json
tsconfig.json
vitest.config.ts
```

**Implications**:
- Repo requires `node ≥20` + `pnpm ≥9`. README documents installation (corepack or brew).
- `package.json` tracks deps: `zod`, `zod-to-json-schema`, `js-yaml`, `commander`, `deepmerge`; dev: `tsx`, `typescript`, `vitest`, `@types/js-yaml`, `@types/node`.
- Entry script invoked via `pnpm` scripts (e.g. `pnpm install:user <preset>`) or shebang `#!/usr/bin/env -S pnpm exec tsx` if an executable bit is needed. The plain shebang `#!/usr/bin/env tsx` only works when `tsx` is globally resolvable → prefer pnpm scripts for portability.
- Tests in `scripts/tests/` run via `pnpm test` (vitest).
- TypeScript types exported from `scripts/lib/types.ts` for reuse.
- CI (Phase 5+) runs `pnpm test` + `pnpm typecheck`.
- R2 (fragile awk parser) **fully resolved** in Phase 2.

---

## CQ-12 — Inter-component dependencies in sidecar

Related: REQ-1 (claudekit core), REQ-4 (install scripts).

**Problem**: A component may require other components (an agent requires a skill, a skill requires a hook, a hook requires an external binary). Currently the sidecar only tracks provenance — if a preset omits a component dependency, the install plan is incomplete and the target does not work correctly.

**CQ-12a — Dependencies schema**:

**Status**: answered (2026-05-07)

**Decision**: **B — Full schema immediately (required/optional/external)**. Sidecar extended:
```yaml
source: { ... }
imported_at: ...
modified: false
dependencies:
  required:
    agents: []
    skills: [coding-standards]
    commands: []
    hooks: []
    rules: []
  optional:
    agents: []
    skills: [python-patterns]
    commands: []
    hooks: []
    rules: []
  external:
    - name: prettier
      type: npm                # npm | system_binary | python_pkg
      version: ">=3.0"
      reason: "Hook format-on-save uses prettier"
    - name: jq
      type: system_binary
      version: ">=1.6"
      reason: "Hook parse JSON output"
```

**CQ-12b — Resolution policy**:

**Status**: answered (2026-05-07)

**Decision**: **A — Auto-include verbose**. Behavior:
- **required**: auto-add to install plan, log clearly: `[deps] <component> requires: + <type>: <id> (auto-included)`.
- **optional**: skip by default. Requires the `--include-optional` flag to install. Each skipped optional dep is logged so the owner is aware.
- **external**: warn only. Installer runs `which <binary>` or checks version, logs FOUND/NOT FOUND. Does NOT auto-install npm/binary (invasive). Owner installs manually.

**Resolver behavior**:
- Recursive resolution: A → B → C (if B requires C, C is also auto-added).
- Circular detection: A → B → A → abort with a clear error.
- Dedupe: same component required by multiple sources → install only once.
- Manifest records `auto_included: true` for components pulled in via dependency (not explicit in preset) so uninstall can distinguish them.

**Implementation implications**:
- Sidecar zod schema needs sub-schemas for dependencies + external.
- Resolver must have 2 phases: (1) resolve preset extends + components, (2) resolve component dependencies (recursive).
- Dry-run output includes a clear `[deps]` section for the owner to review before applying.
- Phase 5+ could auto-install external deps (`pnpm add prettier` or `brew install jq`) via a `--auto-install-external` flag — deferred to avoid an invasive default.

---

## CQ-11 — Standard format: JSON vs YAML for owner-controlled files

Related: CQ-3a, CQ-3d, CQ-5e (revisions).

**Problem**: When writing by hand (presets, manifests), JSON is more verbose than YAML. Should owner-controlled files switch to YAML?

**File classification**:

**Can switch to YAML (dotclaude-controlled)**:
- `presets/<kind>/<name>.yaml`
- `~/.claude/.dotclaude-manifest.yaml` + project equivalent
- `dependencies.yaml` (already YAML)
- Sidecar `<name>.source.yaml`, `SOURCE.yaml` (already YAML, CQ-2)

**Cannot switch (external conventions)**:
- `~/.claude/settings.json`, `~/.claude.json`, `<repo>/.mcp.json` — Claude Code/MCP convention
- `package.json`, `tsconfig.json` — npm/Node convention
- `presets/schema/preset.schema.json` — JSON Schema, cross-IDE standard
- `marketplace.json`, `plugin.json` (Phase 4) — Anthropic plugin convention

**Status**: answered (2026-05-07)

**Decision**: **Switch to YAML for all owner-controlled files**. Specifically:
- Preset machine file: `.json` → `.yaml`. Schema validation via the `# yaml-language-server: $schema=...` header so the VS Code YAML extension validates.
- Manifest: `.json` → `.yaml`.
- `settings_patch` in preset YAML is a YAML object → serialized to JSON when applied to the target `settings.json` (via `JSON.stringify`).

**Implications**:
- Reuses `js-yaml` already in deps for sidecar + preset + manifest. No new dependency.
- TS layer: `loadPreset()` reads YAML via js-yaml, validates via zod. `loadManifest()` follows the same pattern.
- TypeScript-first schema (zod) remains unchanged; JSON Schema is generated from it for IDE preset YAML validation.

---

## CQ-9 — Migration from the existing skeleton

**Problem**: The skeleton (`packages/`, `scripts/`, `vendor/`) does not match the new design. How to handle it?

**Options**:
- **A. Wipe & rewrite**: delete `packages/`, `scripts/`, build new structure from scratch. Keep `docs/`, `dependencies.yaml` (if still applicable), `vendor/` (if keeping).
- **B. Migrate incrementally**: refactor `packages/user/` → `core/`, `packages/presets/` → `presets/`, rewrite scripts. Preserves per-file git history.
- **C. Parallel branch**: a `redesign/v1` branch rebuilt from scratch, `main` keeps the old skeleton. Merge when done.

**Recommendation**: A. The skeleton is unverified, content is empty, git history is only 2 commits → wiping and rebuilding is simpler than migrating. Keep `docs/` (architecture reference) and decide on `vendor/` per CQ-7.

**Status**: answered (2026-05-07)

**Decision**: **A — Wipe & rewrite**. Phase 0 executes:
```bash
git rm -r packages/
git rm -r scripts/
git mv vendor upstream
git commit -m "chore: wipe skeleton, prepare for redesign"
```
Keep: `docs/`, `CLAUDE.md`, `dependencies.yaml` (review content after), `upstream/` (renamed), `.gitmodules` (update paths). Phase 1 starts fresh build.

---

## Decisions log

> When a CQ is answered, append a summary here for a quick overview.

- **CQ-1a (2026-05-07)** — Top-level core: `claudekit/`. Flat layout: `claudekit/ + presets/ + plugins/ + scripts/`.
- **CQ-1b (2026-05-07)** — Internal layout: Type-first (ECC style). Naming prefix (`web-`, `python-`, ...) for domain-specific components; cross-stack keeps original name.
- **CQ-1c (2026-05-07)** — Import mode: Pure copy. `claudekit/` is the source of truth. A sync-from-upstream script is needed to diff/merge when upstream updates.
- **CQ-1d (2026-05-07)** — Modify tracking: Edit directly + sidecar `modified` flag + `modifications` text. Sync uses `git diff source_commit..upstream`, no separate snapshot, no patch files.
- **CQ-2 (2026-05-07)** — Sidecar YAML. File-component: `<name>.source.yaml` alongside the file. Folder-component (skill): `SOURCE.yaml` inside the folder, installer excludes it when copying. Requires a YAML parser (yq or Node/Python).
- **CQ-3a (2026-05-07)** — Preset schema Phase 1: name, kind, description, version, extends, components{agents,skills,commands,hooks,rules}, settings_patch, tags. No `target_levels`. Defer mcp_servers to Phase 2.
- **CQ-3b (2026-05-07)** — `extends` included from Phase 1. Edge cases (multiple/diamond/circular/conflict) must be handled in installer. Phase 1 has NO override/exclude — append only.
- **CQ-3c (2026-05-07)** — Preset layout: folder by kind (`presets/{core,framework,purpose}/<name>.json`). Kind field kept redundant in JSON for schema validation.
- **CQ-3d (2026-05-07)** — JSON + MD per preset, same name different extension. Installer reads JSON, MD is human docs only. Lint verifies 1-1.
- **CQ-4a (2026-05-07)** — `private/` under each top-level package (`claudekit/private/`, `presets/private/`). Mirrors public structure. Each package has its own gitignore rule.
- **CQ-4b (2026-05-07)** — Structure inside `private/` mirrors public. Installer searches public first, falls back to private when resolving component IDs.
- **CQ-4c (2026-05-07)** — Include `private.example/` + `scripts/init-private.sh`. Minimal skeleton (.gitkeep + README) for new machines.
- **CQ-4d (2026-05-07)** — Private bootstrap: manual / cloud sync. The dotclaude repo does not manage distribution. `docs/PRIVATE.md` documents the convention.
- **CQ-5a (2026-05-07)** — Phase 1 install levels: User + Project. Plugin/MCP deferred.
- **CQ-5b (2026-05-07)** — Hybrid mode: user=symlink default, project=copy default. Flags `--copy`/`--symlink` override.
- **CQ-5c (2026-05-07)** — Conflict policy: backup-then-overwrite default (`.bak.<timestamp>`). Flags `--force`, `--skip-existing`, `--prompt`.
- **CQ-5d (2026-05-07)** — Idempotent re-run is a MUST. Uninstall deferred to Phase 2.
- **CQ-5e (2026-05-07)** — Manifest tracking included from Phase 1. `~/.claude/.dotclaude-manifest.json` + `<repo>/.claude/.dotclaude-manifest.json`.
- **CQ-6a (2026-05-07)** — Marketplace: self-hosted repo `phantien133/claudekit-marketplace`.
- **CQ-6b (2026-05-07)** — Preset ↔ plugin: 1-1, each plugin self-contained.
- **CQ-6c (2026-05-07)** — Marketplace + plugin packaging: last phase, after core + presets + install are stable.
- **CQ-7 (2026-05-07)** — Vendor strategy: rename `vendor/` → `upstream/`, keep all 4 submodules in the same folder. ECC role: source for syncing (not a runtime dependency).
- **CQ-8 (2026-05-07)** — Phase ordering: 5 phases (0 cleanup, 1 core foundation, 2 install pipeline, 3 lifecycle, 4 marketplace).
- **CQ-9 (2026-05-07)** — Migration: wipe & rewrite. `git rm packages/ scripts/`, `git mv vendor upstream`, commit, fresh build in Phase 1.
- **CQ-10 (2026-05-07, revised 2026-05-08)** — Scripts language: 100% TypeScript + pnpm + tsx (revised from Bun due to toolchain absence at Phase 0.5; node 23.7 + pnpm 10.28 available). Zod for schema, Vitest for tests. Repo needs `package.json` + `tsconfig.json`. Resolves R2 (fragile parser).
- **CQ-11 (2026-05-07)** — Standard format: prefer **YAML** for all owner-controlled files (preset → `.yaml`, manifest → `.yaml`). Keep JSON for external conventions (settings.json, .mcp.json, package.json, tsconfig.json, JSON Schema, plugin manifest). `settings_patch` in preset YAML is a YAML object, serialized to JSON when applied to the target. Revisits: CQ-3a, CQ-3d, CQ-5e.
- **CQ-12 (2026-05-07)** — Inter-component dependencies in sidecar:
  - 12a: full schema (required/optional/external) from Phase 1.
  - 12b: auto-include verbose. Required auto-added, optional skipped by default (`--include-optional` flag), external warn-only (no auto-install). Recursive resolution + circular detection + dedupe. Manifest marks `auto_included` for components pulled in via dependency.
