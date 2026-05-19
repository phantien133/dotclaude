# dotclaude-bootstrap

Bootstrap preset for users who are new to dotclaude. Installs the four wizard
components that let you discover, create, debug, and install other presets.

## Who should use this

Anyone who knows Claude Code but hasn't used dotclaude before. Install this once at
user level, then use the included wizards to set up everything else.

## Install

```sh
# From inside the dotclaude repo:
pnpm install:user dotclaude-bootstrap --force --symlink
```

## What's included

| Type | Name | Purpose |
|------|------|---------|
| command | `/dotclaude-setup` | One-time bootstrap wizard — detects or clones dotclaude, finds a preset, installs it |
| command | `/preset-wizard` | Create a new custom preset from scratch with step-by-step guidance |
| skill | `preset-debugger` | Diagnose and fix a broken preset or plugin build |
| skill | `plugin-discovery` | Search GitHub for external Claude Code components to vendor into dotclaude |

## Typical first-session flow

1. Install this preset: `pnpm install:user dotclaude-bootstrap --force --symlink`
2. Open any project in Claude Code
3. Run `/dotclaude-setup` — it walks you through finding a preset that fits your stack
4. If no preset matches, it launches `/preset-wizard` to build one

## Notes

- `preset-debugger` and `plugin-discovery` are sub-components — they are invoked
  automatically by the wizards when needed. You can also call them directly if
  you hit issues with an existing preset.
- This preset has no `settings_patch` — it does not modify your Claude Code settings.
  Any settings changes come from the preset you choose to install via `/dotclaude-setup`.
