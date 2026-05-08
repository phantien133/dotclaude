# PRESETS — Schema & Authoring Guide

> A preset is a **pure manifest** pointing to component IDs in `claudekit/`. It contains no component code.
>
> Schema is TS-first (zod, `scripts/lib/schema.ts → PresetSchema`) → generates a JSON
> Schema for IDE validation (`presets/schema/preset.schema.json`).

## Directory structure (CQ-3c)

```
presets/
├── core/<name>.yaml + <name>.md       # cross-stack baseline
├── framework/<name>.yaml + <name>.md  # framework-specific (Next.js, Django, ...)
├── purpose/<name>.yaml + <name>.md    # task-specific (onboarding, hardening, ...)
├── private/                           # GITIGNORED — owner private (see PRIVATE.md)
├── private.example/                   # TRACKED skeleton
└── schema/                            # Generated JSON Schema
```

The canonical path for a preset is `presets/<kind>/<name>.yaml`. Each preset has two files:

- `.yaml` — machine-readable, schema-validated.
- `.md` — human docs (when to use, rationale, examples).

Filenames MUST be kept in sync 1-to-1 (enforced by the validate command).

## Schema (CQ-3a/b/d)

```yaml
# yaml-language-server: $schema=../schema/preset.schema.json
name: typescript-fullstack            # lowercase kebab-case, matches filename
kind: framework                        # core | framework | purpose, matches folder
description: ...                       # one line, shown in list output
version: 0.1.0                         # SemVer X.Y.Z
extends: []                            # parent preset names (CQ-3b)
components:
  agents: []                           # IDs in claudekit/agents/
  skills: []                           # IDs in claudekit/skills/
  commands: []
  hooks: []
  rules: []
settings_patch: {}                     # deep-merged into ~/.claude/settings.json
tags: []                               # filterable via `pnpm run list --tag <t>`
```

### Field details

- **`name`**: lowercase kebab-case (`personal-baseline`, `nextjs-app`). Must match
  the filename with `.yaml` stripped.
- **`kind`**: `core | framework | purpose` — must match the folder.
  - `core`: cross-stack baseline.
  - `framework`: bound to a specific framework.
  - `purpose`: focused on a particular goal (onboarding, security audit, ...).
- **`description`**: one-line summary of when to use this preset.
- **`version`**: SemVer. Bump when adding/removing components or changing behavior.
- **`extends`**: array of parent preset names. The resolver merges the tree (CQ-3b):
  - Multiple inheritance is OK: `extends: [base-typescript, base-postgres]`.
  - Diamond detection + deduplication.
  - Circular detection → throws.
  - Phase 1 appends only (no `override`/`exclude` support yet).
- **`components`**: 5 fixed keys (agents/skills/commands/hooks/rules), each an array
  of string IDs.
  - Resolver looks up public first, then falls back to private (CQ-4b).
  - The component sidecar's `dependencies.required` are auto-pulled (CQ-12).
- **`settings_patch`**: object deep-merged into the target's `~/.claude/settings.json`.
  The YAML object is serialized to JSON on apply.
- **`tags`**: free-form strings, used for filtering in the list command.

## Creating a new preset

```bash
# 1. Choose kind + name
KIND=core
NAME=my-baseline

# 2. Copy template
cp presets/core/personal-baseline.yaml presets/$KIND/$NAME.yaml
cp presets/core/personal-baseline.md   presets/$KIND/$NAME.md

# 3. Edit YAML — update name/description/components/tags

# 4. Validate
pnpm validate $NAME --kind $KIND

# 5. Verify it appears in the list
pnpm run list

# 6. Commit
```

## extends:

```yaml
# presets/framework/nextjs-app.yaml
name: nextjs-app
kind: framework
description: Next.js App Router preset (extends personal-baseline)
version: 0.1.0
extends:
  - personal-baseline    # pulls in all agents+skills from the baseline automatically
components:
  skills:
    - web-frontend-patterns
  hooks:
    - format-on-save
```

Resolver semantics when composing:
1. Recursively resolve extends → merge components (set union per type).
2. `settings_patch`: deep-merge left-to-right; child wins on conflict.
3. Deduplicate components by `<type>:<id>`.

## settings_patch

Applied on install via deep-merge into the target's `~/.claude/settings.json`:

```yaml
settings_patch:
  hooks:
    PostToolUse:
      - matcher: "Write|Edit"
        command: "pnpm prettier --write \"$FILE_PATH\""
```

Note: the target `settings.json` is JSON. The preset YAML object is deep-merged with the
existing JSON (via the `deepmerge` package) and written back as JSON.

Conflict policy:
- Object: deep-merge.
- Array: concat or replace depending on the field (policy table in `lib/settings-merge.ts`).
- Scalar conflict: child wins, warning is logged.

## File reference

- `scripts/lib/schema.ts → PresetSchema` — zod schema.
- `scripts/lib/preset.ts` — locate/load/list helpers.
- `presets/schema/preset.schema.json` — generated JSON Schema for IDE.
- `presets/core/personal-baseline.yaml` — first preset (Phase 1).
