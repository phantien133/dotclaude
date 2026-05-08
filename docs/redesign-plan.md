# Redesign Plan — dotclaude

> Started: 2026-05-07
>
> Context: the existing skeleton (`packages/`, `scripts/`) was quickly scaffolded by a
> prior Claude session to establish structure, **without verification**. This session
> redesigns the repo structure and installer from scratch based on the owner's new
> requirements. The existing skeleton is preserved until a clear plan is in place.
>
> Process:
> 1. Collect requirements/ideas from the owner (see [Requirements](#requirements)).
> 2. Ask clarifying questions before generating the real plan.
> 3. Generate the redesign plan (see [Plan](#plan)) once requirements are clear enough.
> 4. Resolve the risks and open questions below during the redesign.

---

## 1. Risks from the existing skeleton

These must be addressed or deliberately accepted during the redesign:

### R1 — Destructive `rm -rf` in the installer
- **File**: `scripts/install-preset.sh` (~line 100, 105)
- **Behavior**: `rm -rf '$dst'` runs before each symlink/copy of an ECC skill
- **Failure scenario**: if the awk parser resolves `$dst` incorrectly → `$dst` empty or wrong → may unintentionally delete directories outside the intended target. Partially guarded by `set -euo pipefail`.
- **Failure scenario 2**: the symlink target defaults to `$(pwd)/.claude` → the user **must** `cd` into the project repo before running. Forgetting causes symlinks to point to the wrong location.
- **Redesign requirement**: defensive guards (verify `$dst` is non-empty and within the target dir before deleting); explicit `--target` instead of relying on CWD.

### R2 — Fragile awk parser
- **File**: both `install-user.sh` and `install-preset.sh`
- **Behavior**: parses YAML with awk using hard-coded indentation (2-space section, 4-space key)
- **Failure scenario**: manually editing YAML with wrong indentation → parser returns empty string → script exits with "ECC local_path not configured", or worse, returns an incorrect value while the script continues running.
- **Latent risk**: the `run()` function uses `eval "$@"` — shell injection if path contains special characters. Currently safe because paths are hard-coded in YAML.
- **Redesign requirement**: decide on a parser strategy — keep awk (self-contained), or accept adding a dependency (`yq`, Python, Node) for schema validation.

### R3 — `rsync -a` does not delete stale files
- **File**: `install-user.sh` (overlays personal files into `~/.claude/`)
- **Behavior**: `rsync -a` only adds/updates, no `--delete`
- **Failure scenario**: renaming or deleting a file in `packages/user/agents/` → the old file remains at `~/.claude/agents/`, causing gradual drift.
- **Redesign requirement**: a cleanup strategy — `--delete` (risky with mixed content), manifest-based tracking, or symlinking the entire user layer instead of rsync.

### R4 — ECC installer is a black box with no real version pinning
- **File**: `dependencies.yaml`
- **Behavior**: the `pinned_commit` field for all 4 sources is still `null`. The script reads `local_path` to call `$ECC_DIR/install.sh --target claude --modules <ids>` but does not verify the ECC checkout matches the expected version.
- **Failure scenario**: ECC upstream changes installer flags → dotclaude scripts break silently. Or the submodule gets bumped unintentionally.
- **Redesign requirement**: a pinning mechanism (lockfile or enforced submodule SHA check) and an update/refresh workflow.

### R5 — Preset CLAUDE.md template only copies if not already present
- **File**: `install-preset.sh`
- **Behavior**: skips `CLAUDE.md` if the project already has one
- **Failure scenario**: project has a minimal CLAUDE.md → user doesn't know what the ECC template adds → must merge manually, easy to miss things.
- **Redesign requirement**: a template strategy — copy as `.example`, merge sections, or explicit warning.

### R6 — Default symlink depends on local path of `vendor/ECC`
- Symlinks point to `vendor/everything-claude-code/skills/<id>/` inside the dotclaude repo. If the user clones dotclaude to a different path on another machine, or moves the repo, symlinks break.
- **Redesign requirement**: clearly document that symlinks use absolute paths tied to the dotclaude repo location; re-run installer when moving the repo.

---

## 2. Open questions

Questions without answers in the existing skeleton/docs:

### Q1 — What is the actual ECC installer API?
The script calls `./install.sh --target claude --modules <ids>` but dotclaude has no docs on those flags. Need to verify against `vendor/everything-claude-code/install.sh` (read the source directly) before trusting it.

### Q2 — What will the personal overlays contain?
`packages/user/{rules,agents,commands,hooks,skills}/` is empty. The owner's personal conventions haven't been written down — this is the "why does this repo exist" question that the skeleton hasn't answered.

### Q3 — Settings.json strategy
ECC modules may ship `settings.json` snippets. A user-level `~/.claude/settings.json` already exists (see current owner setup). Not yet decided: overlay (overwrite), merge JSON, or split into `settings.local.json`?

### Q4 — Preset inheritance (`extends:`)
`docs/architecture.md` notes a future pattern: e.g. `nestjs-prisma extends typescript-fullstack`. No schema or implementation yet.

### Q5 — Lockfile for reproducible installs
`dependencies.lock.yaml` is mentioned in the CLAUDE.md TODO but not designed yet. What format? Who generates it? Does CI verify it?

### Q6 — CI / validation
- Validate that `deps.yaml` references actually exist in the ECC manifest?
- Lint agent/skill markdown frontmatter?
- Test the installer in a sandbox?

### Q7 — Distribution / multi-machine
- The owner uses this repo on multiple machines → how to bootstrap quickly on a new machine?
- Is a `bootstrap.sh` needed (clone + submodule init + install user)?

### Q8 — Update workflow
- `scripts/update.sh` does not exist yet. What does "update" mean: `git submodule update --remote` followed by reinstall? Is a diff needed before applying?

---

## 3. Requirements

> Filled in progressively as the owner provides requirements/ideas. Each requirement notes: **what**, **why**, **constraint** (if any).

### REQ-1 — A complete "claudekit" core
- **What**: a complete kit comprising `agents/`, `skills/`, `rules/`, `commands/`, `hooks/`, etc. — serving as the core of the repo (equivalent to ECC but owner-controlled).
- **Source**: aggregated from multiple upstream sources (ECC, `anthropics/skills`, anthropic-cookbook, ...) — either cloned as-is or cloned and modified to personal preference.
- **Provenance**: each component has its own metadata file (upstream URL, commit, whether it has been modified, etc.).
- **Difference from existing skeleton**: the skeleton only wraps ECC via submodule + installer. The new requirement is for the owner to **actually own** the kit, with no runtime dependency on ECC.

### REQ-2 — Presets are pure manifests (md/json, prefer json)
- **What**: presets do NOT contain component code — they are files that describe "preset X uses these components from the core".
- **Classification axes**: by framework (e.g. Next.js, Django), by core baseline (cross-stack), by specific purpose for each project type.
- **Format**: prefer JSON for machine-readability by the installer; Markdown may coexist for human docs.
- **Difference from existing skeleton**: the current skeleton has a `skills/` directory per preset (though it's empty). The new requirement is that **presets only point to the core**, they don't contain code themselves.

### REQ-3 — `private/` folder at each level (gitignored)
- **What**: at each appropriate level (core/, presets/, possibly each component type), a `private/` folder holds the owner's private content — project-specific, company-specific, secrets, internal conventions.
- **Constraint**: `private/` is gitignored so it can be used locally without leaking when the repo is pushed publicly.
- **Goal**: fully usable locally with all features + safe when the repo is public or shared.

### REQ-4 — Install script driven by presets, multi-level
- **What**: scripts read a preset (md/json, prefer json) and install the corresponding components to the appropriate target.
- **Levels**: user-level (`~/.claude/`), repo-level (`<project>/.claude/`), and possibly other levels per Claude conventions.
- **Constraint**: must follow official Claude Code conventions (paths `~/.claude/agents/*.md`, `~/.claude/skills/<name>/SKILL.md`, `~/.claude/commands/*.md`, frontmatter format, hook config in `settings.json`, etc.).

### REQ-5 — Marketplace + plugin per preset
- **What**: support Claude Code marketplace + plugin model — package presets as plugins to install via the marketplace, not just via a local script.
- **Goal**: one preset can be published as one plugin package, so others (or the owner on a new machine) can install it via `/plugin install ...` using the official Claude Code flow.

---

## 4. Clarifying questions for the owner

> Moved to [clarifying-questions.md](./clarifying-questions.md) for easier per-CQ status tracking (`pending`/`asking`/`answered`). That file is the source of truth; this file only holds a pointer.
>
> Summary: 9 CQ groups, CQ-1 → CQ-9. When a CQ is answered, the decision is synced back here (Section 5 — Plan) when the plan is generated.

<details>
<summary>Snapshot of 9 CQ groups (see separate file for details)</summary>

### CQ-1 — Core layout (REQ-1)

**a)** Name and location of the core at root: `core/`, `kit/`, `claudekit/`, or `packages/core/`?

**b)** Internal structure of the core — choose one:
  - **Type-first** (ECC style): `core/agents/`, `core/skills/`, `core/commands/`, `core/hooks/`, `core/rules/` — flat by component type.
  - **Domain-first**: `core/web/{agents,skills}/`, `core/python/{agents,skills}/` — grouped by domain first, then type.
  - **Hybrid**: top-level type, sub-folder domain inside (e.g. `core/skills/web/`, `core/skills/python/`).

**c)** When vendoring a component from ECC: copy the file into `core/` and attach metadata, or keep the submodule and symlink? The owner wants to **own the content** → likely copy-in, correct?

**d)** When modifying a component cloned from upstream: use a separate patch file applied on each update, or edit the file directly and store a diff in the metadata?

### CQ-2 — Provenance metadata format (REQ-1)

Choose one:
- **Per-file frontmatter**: add a `source:` field to the existing YAML frontmatter of the agent/skill/command. Pro: same file. Con: only works for markdown files with frontmatter.
- **Sidecar file**: each component has a `<name>.source.json` (or `.source.md`) alongside it. Pro: uniform format, covers files without frontmatter (hooks, json). Con: extra file.
- **Centralized manifest**: one `core/PROVENANCE.json` (or `.yaml`) listing everything. Pro: single place to scan. Con: prone to drift if a file is modified without updating the manifest.

The owner wrote "**a separate metadata file per component**" → leaning toward sidecar or per-file frontmatter. Confirm?

Required fields? Minimum proposal: `source_repo`, `source_commit`, `source_path`, `imported_at`, `modified` (bool), `modifications` (short description if modified).

### CQ-3 — Preset format (REQ-2)

**a)** Proposed JSON schema:
```json
{
  "name": "typescript-fullstack",
  "kind": "framework | core | purpose",
  "description": "...",
  "extends": ["base-typescript"],
  "components": {
    "agents": ["code-reviewer", "tdd-guide"],
    "skills": ["coding-standards", "frontend-patterns"],
    "commands": [...],
    "hooks": [...],
    "rules": [...]
  },
  "settings": { "snippet to merge into settings.json": "..." }
}
```
OK? Any fields to add or remove?

**b)** Should `extends:` be implemented in this redesign, or deferred to Phase 2?

**c)** Where does the `framework | core | purpose` axis live: separate directories (`presets/framework/`, `presets/core/`, `presets/purpose/`), or flat with a `kind` field?

**d)** What is the Markdown companion for — docs only (README per preset), or also readable by the installer?

### CQ-4 — `private/` placement (REQ-3)

**a)** "Each level" means:
  - Option A: only at root level → `private/`.
  - Option B: at each top-level package → `core/private/`, `presets/private/`.
  - Option C: at each component type → `core/agents/private/`, `core/skills/private/`, `presets/private/`. Deepest mirroring.

  Which does the owner prefer?

**b)** Does the structure inside `private/` mirror the public structure (e.g. `private/agents/foo.md`), or is it free-form?

**c)** Is a `private.example/` needed (a tracked template with example commits as guidance)?

**d)** Multi-machine: `private/` is not tracked by git → what's the bootstrapping strategy for a new machine (separate dotfiles repo, 1Password, manual copy)? Is a separate `dotclaude-private` (private repo) needed?

### CQ-5 — Install levels & semantics (REQ-4)

**a)** Official Claude Code levels to support:
  - User: `~/.claude/` (agents, skills, commands, hooks via settings.json)
  - Project: `<repo>/.claude/`
  - Plugin: `~/.claude/plugins/<name>/` (per plugin model)
  - MCP servers: config in `~/.claude.json` or `<repo>/.mcp.json`
  
  Support all levels, or narrow the scope for the first phase?

**b)** Install action — pick semantics:
  - **Copy**: safe, no dependency on the dotclaude repo after install. Updates require re-running.
  - **Symlink**: live link to `core/`, edits to core take effect immediately. Depends on absolute path.
  - **Hybrid**: symlink by default, `--copy` flag for standalone.

  Which should be the default?

**c)** Conflict policy when a file already exists at the target: skip, overwrite, backup-then-overwrite, or prompt?

**d)** Idempotent re-run + uninstall: needed in the first phase?

**e)** Manifest tracking: record "what was installed" at the target (e.g. `~/.claude/.dotclaude-manifest.json`) so uninstall/update knows what to remove?

### CQ-6 — Marketplace & plugin (REQ-5)

**a)** Marketplace target: official Claude Code plugin marketplace (in the format Anthropic defines), or the owner's self-hosted marketplace (e.g. a GitHub repo `phantien133/claudekit-marketplace` containing plugin manifests)?

**b)** Preset ↔ plugin relationship:
  - 1-1: each preset = one independent plugin package?
  - N-1: multiple presets bundled into one mega plugin?
  - Two-tier: core plugin + preset plugin that extends it?

**c)** Plugin packaging: does this phase only need a preset → plugin bundle script (`scripts/build-plugin.sh`), or does it need a CI/CD publish pipeline too?

**d)** Phase: when does the marketplace come in? Does the owner want to redesign the repo first and then build the marketplace, or must the design support the marketplace from the start?

### CQ-7 — Vendor strategy (cross-cutting with REQ-1)

**a)** After the redesign, should `vendor/` submodules be kept?
  - Keep the ECC submodule as a **sync source**, with the core being a copy-with-modifications → need a workflow to merge upstream ECC updates into the core.
  - Drop submodules entirely, only record `source_commit` in metadata, updates are one-time manual operations.

**b)** If keeping submodules for doc purposes (anthropic-cookbook, anthropic-skills, mcp-servers), should they be moved out of `vendor/` (since they are no longer "vendored runtime")?

### CQ-8 — Phase ordering

Which order does the owner prefer:
  1. Core layout + provenance first → preset manifest → install script → marketplace?
  2. Small MVP scope: only core + 1 preset + user-level install, then expand?
  3. Work in parallel?

Needed to divide the plan into clear phases.

### CQ-9 — Migration from existing skeleton

The existing skeleton (`packages/`, `scripts/`, `vendor/`) will be:
  - **Wipe & rewrite**: delete everything, start over with the new design.
  - **Migrate**: keep whatever is still usable, refactor incrementally.
  - **Parallel branch**: skeleton stays on `main`, redesign on a new branch, merge when stable.

Which does the owner choose?

</details>

---

## 5. Plan

> Generated 2026-05-07 after all 9 CQ groups in [clarifying-questions.md](./clarifying-questions.md) were resolved. Each decision is recorded in the "Decisions log" in that file.

### 5.1. Target layout (after Phase 1)

```
dotclaude/
├── CLAUDE.md                    # updated to reflect new design
├── README.md                    # updated
├── dependencies.yaml            # rewritten — lists upstream sources + commit pins
├── .gitignore                   # /claudekit/private/, /presets/private/, ...
├── .gitmodules                  # paths updated to upstream/
│
├── claudekit/                   # core kit, type-first
│   ├── agents/
│   │   ├── code-reviewer.md
│   │   ├── code-reviewer.source.yaml      # provenance sidecar
│   │   ├── web-frontend-reviewer.md       # domain-prefixed naming
│   │   └── web-frontend-reviewer.source.yaml
│   ├── skills/
│   │   ├── coding-standards/
│   │   │   ├── SKILL.md
│   │   │   └── SOURCE.yaml                # sidecar inside folder, installer EXCLUDES
│   │   └── web-frontend-patterns/
│   │       ├── SKILL.md
│   │       └── SOURCE.yaml
│   ├── commands/
│   │   ├── <name>.md
│   │   └── <name>.source.yaml
│   ├── hooks/
│   │   ├── <name>.sh                      # actual script
│   │   └── <name>.source.yaml
│   ├── rules/
│   │   ├── <name>.md
│   │   └── <name>.source.yaml
│   ├── private/                           # GITIGNORED, mirrors above
│   │   ├── agents/
│   │   ├── skills/
│   │   ├── commands/
│   │   ├── hooks/
│   │   └── rules/
│   └── private.example/                   # TRACKED, guidance skeleton
│       ├── README.md
│       ├── agents/.gitkeep
│       ├── skills/.gitkeep
│       └── ...
│
├── presets/                     # pure manifests, YAML + MD per preset
│   ├── core/
│   │   ├── personal-baseline.yaml
│   │   └── personal-baseline.md
│   ├── framework/
│   │   ├── nextjs-app.yaml
│   │   └── nextjs-app.md
│   ├── purpose/
│   │   └── ...
│   ├── private/                           # GITIGNORED
│   │   ├── core/
│   │   ├── framework/
│   │   └── purpose/
│   ├── private.example/                   # TRACKED
│   │   ├── README.md
│   │   └── framework/.gitkeep
│   ├── README.md                          # explains presets in general
│   └── schema/
│       └── preset.schema.json             # JSON Schema (cross-IDE standard) for validating preset YAML via header comment
│
├── plugins/                     # PHASE 4 — build artifacts for marketplace
│   └── (empty until Phase 4)
│
├── upstream/                    # renamed from vendor/ — sync source + reference
│   ├── everything-claude-code/  (submodule, role: sync source)
│   ├── anthropic-cookbook/      (submodule, role: docs)
│   ├── anthropic-skills/        (submodule, role: docs)
│   └── mcp-servers/             (submodule, role: docs)
│
├── package.json                 # deps: zod, js-yaml, commander, deepmerge, vitest
├── tsconfig.json
├── vitest.config.ts
├── pnpm-lock.yaml               # pnpm lockfile
│
├── scripts/                     # 100% TypeScript, run via tsx (pnpm exec)
│   ├── install.ts               # entry dispatcher: user|project|list|validate
│   ├── install-user.ts          # default symlink
│   ├── install-project.ts       # default copy
│   ├── init-private.ts          # copy private.example → private for new machine
│   ├── sync-from-upstream.ts    # diff upstream component
│   ├── clean-backups.ts         # remove old .bak.* files
│   ├── lib/
│   │   ├── types.ts             # TypeScript types (Preset, Sidecar, Manifest)
│   │   ├── schema.ts            # zod schemas (runtime validation + types)
│   │   ├── sidecar.ts           # read/write SOURCE.yaml + <name>.source.yaml
│   │   ├── manifest.ts          # read/write .dotclaude-manifest.yaml
│   │   ├── resolver.ts          # extends tree, component lookup public+private
│   │   ├── settings-merge.ts    # deep-merge JSON for settings_patch
│   │   ├── fs-ops.ts            # symlink/copy/backup helpers
│   │   └── logger.ts            # uniform output (info/warn/error)
│   └── tests/
│       ├── resolver.test.ts
│       ├── settings-merge.test.ts
│       ├── manifest.test.ts
│       └── fixtures/            # preset samples for tests
│
└── docs/
    ├── architecture.md          # updated to reflect new design
    ├── redesign-plan.md         # this file
    ├── clarifying-questions.md  # all resolved CQs
    ├── PRIVATE.md               # private/ convention + manual bootstrap
    ├── PROVENANCE.md            # how to use sidecar source.yaml
    ├── PRESETS.md               # schema + how to write a preset
    └── INSTALL.md               # how to use install scripts
```

### 5.2. Phase 0 — Clean up skeleton

**Goal**: remove the unverified skeleton, prepare the foundation for the redesign.

**Steps**:
1. Verify branch is clean, no pending changes: `git status`.
2. Read `dependencies.yaml` carefully to identify what to keep — only the `sources` block for ECC + 3 docs sources; drop `pinned_commit: null` and old schema that doesn't match the new design.
3. `git rm -r packages/`
4. `git rm -r scripts/`
5. `git mv vendor upstream` — git automatically updates `.gitmodules` path entries; verify `.gitmodules` uses `path = upstream/...`.
6. Update `.gitignore` to add:
   ```gitignore
   /claudekit/private/
   /presets/private/
   /plugins/private/
   *.bak.*
   .dotclaude-manifest.yaml    # in case of accidental commit
   ```
7. Commit `chore: wipe skeleton, prepare redesign` with HEREDOC body explaining the change.

**Risks resolved**: R1, R2, R3 (old installer with `rm -rf` + awk parser removed).

**Done when**: `tree -L 2` shows only `upstream/`, `docs/`, `CLAUDE.md`, `dependencies.yaml`.

### 5.2.1. Phase 0.5 — TypeScript toolchain bootstrap

**Goal**: set up pnpm + TS + tsx (CQ-10 revised 2026-05-08) so Phase 1 has a ready foundation.

**Steps**:
1. Verify toolchain: `node --version` (≥20), `pnpm --version` (≥9). If pnpm is missing: `corepack enable` or `brew install pnpm`.
2. Manually create `package.json`, `tsconfig.json`, `vitest.config.ts` (avoid `pnpm init` to prevent template bloat).
3. Install dependencies:
   ```bash
   pnpm add zod zod-to-json-schema js-yaml commander deepmerge
   pnpm add -D tsx typescript vitest @types/js-yaml @types/node
   ```
4. `tsconfig.json`: `"strict": true`, `"target": "ES2022"`, `"module": "ESNext"`,
   `"moduleResolution": "Bundler"`, `"allowImportingTsExtensions": true`,
   `"noEmit": true`.
5. `vitest.config.ts` sets the test root to `scripts/tests/`.
6. Add `package.json` scripts:
   ```json
   {
     "scripts": {
       "typecheck": "tsc --noEmit",
       "test": "vitest run",
       "test:watch": "vitest",
       "install:user": "tsx scripts/install.ts user",
       "install:project": "tsx scripts/install.ts project",
       "validate": "tsx scripts/install.ts validate",
       "list": "tsx scripts/install.ts list",
       "sync": "tsx scripts/sync-from-upstream.ts",
       "init-private": "tsx scripts/init-private.ts",
       "clean-backups": "tsx scripts/clean-backups.ts"
     }
   }
   ```
7. Commit `chore: init TypeScript + pnpm toolchain`.

**Done when**: `pnpm typecheck` passes, `pnpm test` runs (zero tests is fine).

### 5.3. Phase 1 — Core foundation

**Goal**: new skeleton with structure + 1 real component + 1 real preset to verify the provenance + reference flow end-to-end.

**Steps**:

1. **Create empty directory structure** (`.gitkeep` to track):
   - `claudekit/{agents,skills,commands,hooks,rules}/`
   - `claudekit/private.example/{agents,skills,commands,hooks,rules}/.gitkeep`
   - `presets/{core,framework,purpose}/`
   - `presets/private.example/{core,framework,purpose}/.gitkeep`
   - `presets/schema/`
   - `plugins/` (empty, .gitkeep)
   - `scripts/lib/`
   - Update `.gitignore` with full private rules.

2. **Define schema (TypeScript-first)**:
   - `scripts/lib/schema.ts` — zod schemas for `Preset`, `Sidecar`, `Manifest`. Types inferred from zod (`z.infer<typeof PresetSchema>`).
   - Generate JSON Schema for preset from zod (via `zod-to-json-schema`) → write to `presets/schema/preset.schema.json` so VS Code YAML extension validates preset YAML via the comment header `# yaml-language-server: $schema=...`.
   - Document the sidecar format in `docs/PROVENANCE.md`.

3. **Vendor 1 real component from ECC** (verify provenance + dependencies flow end-to-end):
   - Pick a simple agent from `upstream/everything-claude-code/agents/` (e.g. `code-reviewer.md`).
   - Copy → `claudekit/agents/code-reviewer.md`.
   - Create `claudekit/agents/code-reviewer.source.yaml`:
     ```yaml
     source:
       repo: https://github.com/affaan-m/everything-claude-code
       commit: <git -C upstream/everything-claude-code rev-parse HEAD>
       path: agents/code-reviewer.md
       ref: main
     imported_at: 2026-05-07
     license: MIT
     modified: false
     modifications: null
     notes: null
     # CQ-12: inter-component dependencies
     dependencies:
       required:
         agents: []
         skills:
           - coding-standards   # this agent requires the skill rules to function correctly
         commands: []
         hooks: []
         rules: []
       optional:
         agents: []
         skills: []
         commands: []
         hooks: []
         rules: []
       external: []
     ```
   - Similarly, vendor 1 skill (folder) to verify the SOURCE.yaml flow:
     - Copy `upstream/.../skills/coding-standards/` → `claudekit/skills/coding-standards/` (entire folder).
     - Create `claudekit/skills/coding-standards/SOURCE.yaml` (same schema, deps can be empty for a foundation skill).
   - **Test dependency resolution end-to-end**: preset only lists `agents: [code-reviewer]` → resolver automatically pulls skill `coding-standards` via sidecar deps → verify install plan is correct.

4. **Create 1 real preset**:
   - `presets/core/personal-baseline.yaml`:
     ```yaml
     # yaml-language-server: $schema=../schema/preset.schema.json
     name: personal-baseline
     kind: core
     description: Cross-stack baseline for all projects.
     version: 0.1.0
     extends: []
     components:
       agents:
         - code-reviewer
       skills:
         - coding-standards
       commands: []
       hooks: []
       rules: []
     settings_patch: {}
     tags:
       - baseline
     ```
   - `presets/core/personal-baseline.md` — human docs (when to use, rationale).

5. **Script `scripts/sync-from-upstream.ts` (skeleton)**:
   - Invoked via `pnpm sync <component>` (package.json script wraps `tsx`).
   - Input: component path (e.g. `agents/code-reviewer`).
   - Reads sidecar `.source.yaml` via `scripts/lib/sidecar.ts` → `source_commit`.
   - Spawns `git -C upstream/<repo> fetch && git diff <source_commit>..HEAD -- <source_path>`
     → prints the diff for the owner.
   - Owner manually copies/merges (Phase 1 does not auto-apply).

6. **Docs**:
   - `docs/PRIVATE.md` — convention, gitignore rules, manual bootstrap for a new machine.
   - `docs/PROVENANCE.md` — sidecar schema + sync workflow.
   - `docs/PRESETS.md` — preset schema + how to write a preset.
   - Update `docs/architecture.md` — replace skeleton content with new design.
   - Update root `CLAUDE.md` — reflect the 5 phases + key decisions.

7. **Validate** — `scripts/install.ts validate <preset>`:
   - Read preset JSON, parse via zod schema → throw on failure.
   - For every component ID in the preset, check the path exists in `claudekit/<type>/<id>` or `claudekit/private/<type>/<id>`.
   - Read every sidecar (`.source.yaml` and `SOURCE.yaml` for skill folders), parse via zod → valid.
   - Vitest tests for schema validation.

**Risks resolved**: R4 (provenance + commit pin in sidecar instead of null).

**Done when**: validate script passes, can `cat` the provenance of 1 component and `cat` the finalized preset.

### 5.4. Phase 2 — Install pipeline

> See details: [`docs/planning/phase-2-install-pipeline.md`](planning/phase-2-install-pipeline.md)

**Goal**: install 1 preset into a user/project target, idempotent, with manifest tracking.

**Milestones** (see planning file to track each step):
- M1: Resolver (extends tree + deps recursive, pure/no-fs)
- M2: FS ops + manifest atomic read/write
- M3: `install:user` command end-to-end
- M4: `install:project` command
- M5: `init-private` + `clean-backups` utilities

**Risks resolved**: R1, R2, R3, R5.

**Done when**: install + reinstall + dry-run + 1 preset extending another all run correctly.

### 5.5. Phase 3 — Lifecycle

> See details: [`docs/planning/phase-3-lifecycle.md`](planning/phase-3-lifecycle.md)

**Goal**: full lifecycle — uninstall, upgrade, audit.

**Done when**: install → modify → uninstall round-trip is clean (no leftover at target).

### 5.6. Phase 4 — Marketplace + plugin

> See details: [`docs/planning/phase-4-marketplace.md`](planning/phase-4-marketplace.md)

**Goal**: publish 1-2 presets to a self-hosted marketplace.

**Done when**: publish + install round-trip via marketplace succeeds for at least 1 preset.

### 5.7. Phase 5+ — Deferred

Add to schema + installer when needed:
- `mcp_servers` field in preset.
- `target_levels` field (if level mismatches become frequent).
- Preset extends `override` / `exclude` when the pattern repeats.
- `tags` filter command (`claudekit list --tag <tag>`).
- Plugin-level install (`~/.claude/plugins/<name>/`).
- CI: validate schema + references + lint sidecar.

### 5.8. Risk tracking

Mapping risks from Section 1 → resolving phase:

| Risk | Phase | Resolution |
|---|---|---|
| R1 — `rm -rf` destructive | 0 (remove old installer), 2 (new defensive guards) | Verify `$dst` is non-empty and within target dir before deleting; explicit `--target` instead of CWD-dependent. |
| R2 — Fragile awk parser | 2 | TypeScript + zod schema. `js-yaml` for YAML, built-in `JSON.parse`. Compile-time types + runtime validation. awk removed entirely. |
| R3 — `rsync -a` no cleanup | 2 | Manifest tracking instead of blind rsync. Phase 3 uninstall reads the manifest, no guessing. |
| R4 — `pinned_commit: null` | 1 | Sidecar has accurate `source_commit`. `dependencies.yaml` updated with real pin. |
| R5 — CLAUDE.md skip if present | 2 | Settings_patch + manifest tracking replaces skip-if-exists template approach. CLAUDE.md template still exists but is no longer the primary mechanism. |
| R6 — Symlink absolute path | 2 (user level still symlinks, clearly documented) | `INSTALL.md` explicitly states symlinks depend on the dotclaude path. Migration script when moving the repo. Project level uses copy (CQ-5b) → most use cases unaffected. |

### 5.9. Open questions resolution

| Q | Phase | Note |
|---|---|---|
| Q1 — ECC installer API | No longer used | Phase 0 wipe → ECC installer is no longer called. |
| Q2 — Personal overlay content | 1 + ongoing | Phase 1 creates 1 sample overlay. Owner adds more incrementally. |
| Q3 — Settings.json strategy | 2 | settings_patch + deep-merge + manifest. |
| Q4 — Preset extends | 1 (schema), 2 (resolver) | Confirmed to be supported from Phase 1, schema ready. |
| Q5 — Reproducible lockfile | 5+ | Manifest covers part of this. Separate lockfile if needed in Phase 5+. |
| Q6 — CI validation | 5+ | Deferred. |
| Q7 — Multi-machine bootstrap | 1 (private), N/A | Manual per CQ-4d. Cloning dotclaude is sufficient for public content. |
| Q8 — Update workflow | 1 (sync-from-upstream), 3 (upgrade) | Split into two layers: upstream sync (refresh source) vs install upgrade (refresh target). |
