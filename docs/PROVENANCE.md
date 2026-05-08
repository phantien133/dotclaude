# PROVENANCE — Sidecar files

> Applies to all components in `claudekit/` and `claudekit/private/`.

## Why do we need a sidecar?

Components in `claudekit/` are **owned copies** (CQ-1c). To know where they came from,
which commit, whether they've been modified, and what they depend on at install time —
metadata must live alongside the component.

A sidecar:
- Stores provenance (repo + commit + path + license).
- Stores the `modified` flag + diff summary when the owner edits a component.
- Stores inter-component dependencies (CQ-12) → the resolver auto-includes them on install.

Schema is TS-first via `zod` (see `scripts/lib/schema.ts → SidecarSchema`). JSON Schema
is generated at `presets/schema/sidecar.schema.json` for IDE validation.

## Layout (CQ-2)

### File-component (agent / command / hook / rule — single file)

```
claudekit/agents/code-reviewer.md          ← component
claudekit/agents/code-reviewer.source.yaml ← sidecar
```

The sidecar uses a `.source.yaml` suffix; its base name matches the component file (extension stripped).

### Folder-component (skill — folder with SKILL.md + assets)

```
claudekit/skills/coding-standards/
├── SKILL.md          ← component entry
├── SOURCE.yaml       ← sidecar (INSIDE the folder)
└── ...               ← other skill assets
```

The sidecar is always named `SOURCE.yaml` at the folder root. **The installer MUST EXCLUDE
`SOURCE.yaml` when copying a folder to the target** (`~/.claude/skills/<name>/` should not
contain `SOURCE.yaml`).

## Schema

```yaml
# yaml-language-server: $schema=../../presets/schema/sidecar.schema.json
source:
  repo: https://github.com/<org>/<repo>     # upstream URL
  commit: <40-char SHA>                      # full commit SHA at import time
  path: agents/code-reviewer.md              # path within upstream
  ref: main                                  # branch/tag being tracked
imported_at: 2026-05-08                     # ISO date YYYY-MM-DD
license: MIT                                 # upstream license
modified: false                              # true if the owner has edited this
modifications: null                          # description of changes when modified: true
notes: null                                  # free-form notes (e.g. "vendored to test deps flow")
dependencies:
  required:                                  # auto-installed by the resolver
    agents: []
    skills: [coding-standards]
    commands: []
    hooks: []
    rules: []
  optional:                                  # skipped by default; enable with --include-optional
    agents: []
    skills: []
    commands: []
    hooks: []
    rules: []
  external:                                  # warn-only, not auto-installed
    - name: prettier
      type: npm                              # npm | system_binary | python_pkg
      version: ">=3.0"
      reason: "Hook format-on-save uses prettier"
```

## Workflow: vendor a new component

```bash
# 1. Find the component in upstream
ls upstream/everything-claude-code/agents/

# 2. Copy the content (file-component)
cp upstream/everything-claude-code/agents/<name>.md claudekit/agents/<name>.md

# Or for a folder-component
mkdir -p claudekit/skills/<name>
cp -r upstream/everything-claude-code/skills/<name>/* claudekit/skills/<name>/

# 3. Get the commit pin
git -C upstream/everything-claude-code rev-parse HEAD

# 4. Create the sidecar (copy another component's sidecar as a starter template)
$EDITOR claudekit/agents/<name>.source.yaml
# or claudekit/skills/<name>/SOURCE.yaml

# 5. Verify schema
pnpm typecheck
pnpm test scripts/tests/preset-fixtures.test.ts
pnpm validate <preset-referencing-this-component> --kind core   # if a preset exists
```

## Workflow: modify a vendored component

```yaml
# After editing claudekit/agents/code-reviewer.md
modified: true
modifications: |
  - Removed "ECC originated" line in intro.
  - Added section about dotclaude-specific review rubric.
```

Tip: `modifications` is a multi-line literal block. Update it on every edit.

## Workflow: sync upstream changes

```bash
# Diff sidecar.commit ↔ upstream HEAD for the given path
pnpm sync agents/code-reviewer

# Output:
# - If commit matches HEAD → "No changes"
# - If different → diff is shown for owner review
# Owner manually merges desired changes into claudekit/, then updates sidecar.commit
# and bumps the modified flag if needed.
```

`pnpm sync` is DIFF-only — it does not auto-apply (Phase 1). Advanced auto-merge may be
added later via an `--apply` flag (Phase 5+).

## Dependency resolution (Phase 2 will implement fully)

The resolver reads the `dependencies` block of each installed component:

- **required**: auto-included in the install plan, logged as
  `[deps] code-reviewer requires: + skill: coding-standards (auto-included)`.
  Recursive: A → B → C are all included.
- **optional**: skipped by default. Pass `--include-optional` to install all. Each skipped
  optional is logged so the owner is aware.
- **external**: probe-only.
  - `type: npm` → check `pnpm ls --depth=0` (in the cwd target for project installs, or globally).
  - `type: system_binary` → `which <name>`.
  - `type: python_pkg` → `pip show <name>`.
  - Logs FOUND/NOT FOUND with version match. NOT auto-installed (may be added in Phase 5+ via a flag).

Edge cases:
- **Circular**: A → B → A → resolver throws a clear error.
- **Diamond**: A → {B, C}, B → D, C → D → D is included once (deduped by `<type>:<id>`).
- **Manifest tracking**: components pulled in via dependency have `auto_included: true` plus
  `required_by: ["agent:code-reviewer"]` so the uninstaller can distinguish them.

## File reference

- `claudekit/agents/code-reviewer.source.yaml` — first vendored agent (Phase 1).
- `claudekit/skills/coding-standards/SOURCE.yaml` — first vendored skill (Phase 1).
- `scripts/lib/schema.ts → SidecarSchema` — runtime + compile-time validation.
- `scripts/lib/sidecar.ts` — locate + load helpers.
- `scripts/sync-from-upstream.ts` — diff helper.
