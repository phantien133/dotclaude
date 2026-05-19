# Preset Reference

> Condensed from `docs/PRESETS.md`. Read the full doc for extends: semantics and settings_patch details.

## Directory layout

```
presets/
├── core/<name>.yaml + <name>.md       # cross-stack baseline
├── framework/<name>.yaml + <name>.md  # framework-specific (Next.js, Django, ...)
├── purpose/<name>.yaml + <name>.md    # task-specific (onboarding, learning, ...)
├── private/                           # GITIGNORED — owner private
└── schema/                            # Generated JSON Schema
```

Each preset has two files: `.yaml` (schema-validated) + `.md` (human docs). Names must match.

## Full schema

```yaml
# yaml-language-server: $schema=../../presets/schema/preset.schema.json
name: my-preset               # lowercase kebab-case, matches filename
kind: core                    # core | framework | purpose — matches folder
description: >-
  One-line summary of when to use this preset.
version: 0.1.0                # SemVer X.Y.Z — bump when components change
extends: []                   # parent preset names (pulls their components in)
components:
  agents: []                  # IDs in claudekit/agents/
  skills: []                  # IDs in claudekit/skills/
  commands: []
  hooks: []
  rules: []
settings_patch: {}            # deep-merged into target's .claude/settings.json on install
tags: []                      # filterable via `pnpm run list --tag <t>`
```

## Creating a preset (quickstart)

```bash
KIND=core   # or: framework, purpose
NAME=my-preset
cp presets/core/developer/preset.yaml presets/$KIND/$NAME/preset.yaml
cp presets/core/developer/README.md   presets/$KIND/$NAME/README.md
$EDITOR presets/$KIND/$NAME.yaml       # update name/kind/description/components/tags

pnpm validate $NAME --kind $KIND       # validates schema + all component IDs exist
pnpm run list                          # confirm it appears
```

## Adding a component to an existing preset

Edit the preset's `.yaml` directly:
```yaml
components:
  skills:
    - my-new-skill    # add here
  agents:
    - my-new-agent
```

Then validate:
```bash
pnpm validate <preset-name> --kind <kind>
```

## settings_patch — wiring hooks

Use this to inject hooks into the target's `.claude/settings.json` on install:
```yaml
settings_patch:
  hooks:
    PreToolUse:
      - matcher: "*"
        hooks:
          - type: command
            command: ".claude/skills/my-skill/hooks/hook.sh pre"
    PostToolUse:
      - matcher: "*"
        hooks:
          - type: command
            command: ".claude/skills/my-skill/hooks/hook.sh"
```

Arrays are concatenated (not replaced) by default. The installer deduplicates on re-install with `--force`.

## extends: semantics

```yaml
extends:
  - developer   # pulls all its components in automatically
```

- Multiple inheritance OK: `extends: [base-typescript, base-postgres]`
- Diamond → deduped; circular → error
- `settings_patch` deep-merged child-wins; components are a set union

## Install commands

```bash
# Into this project (.claude/ at repo root)
pnpm install:project <preset-name> --symlink --force

# Into user-level (~/.claude/)
pnpm install:user <preset-name> --symlink --force
```

Flags:
- `--symlink`: symlink instead of copy (default for same-repo installs)
- `--force`: overwrite in-place without creating `.bak` backups
- `--skip-existing`: skip components already present
- `--dry-run`: preview what would be installed

> **Pitfall**: `pnpm install <preset>` is intercepted by pnpm as an npm install. Always use `pnpm install:project` or `pnpm install:user`.
