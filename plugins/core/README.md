# core

Universal baseline for any Claude Code user. Stack-agnostic, project-agnostic.
Designed to be inherited by more specific presets (`ai-native`, `developer`, framework presets, etc.).

## Who should use this

Anyone using Claude Code — regardless of language, stack, or project type.
Install at **user level** so it applies to all your projects.

## Components

| Type | Name | Purpose |
|------|------|---------|
| skill | `doc-coauthoring` | Structured workflow for writing docs, proposals, and specs |
| hook | `suggest-compact` | Suggests `/compact` at strategic moments to preserve context |
| hook | `pre-compact` | Saves session state before compaction runs |
| hook | `desktop-notify` | Desktop notification when Claude finishes a task |
| hook | `cost-tracker` | Appends per-session token usage to `~/.claude/metrics/costs.jsonl` |
| hook | `doc-file-warning` | Warns before creating ad-hoc doc files (NOTES, TODO, SCRATCH, etc.) |

## External tools

### mgrep (required)

Semantic code search plugin from Mixedbread. Mandatory per project rules — use
`mgrep` instead of Grep/Glob for all code searches.

This preset registers the Mixedbread-Grep marketplace and auto-enables the plugin
via `settings_patch`. If the plugin isn't installed yet:

```
/plugins install mgrep@Mixedbread-Grep
```

## Hook event wiring

After installing, add the hooks block to your `~/.claude/settings.json` (user-level install):

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/suggest-compact.js" }] },
      { "matcher": "Write", "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/doc-file-warning.js" }] }
    ],
    "PreCompact": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/pre-compact.js" }] }
    ],
    "Stop": [
      { "matcher": "", "hooks": [
        { "type": "command", "command": "node ~/.claude/hooks/desktop-notify.js" },
        { "type": "command", "command": "node ~/.claude/hooks/cost-tracker.js" }
      ]}
    ]
  }
}
```

For **project-level** install, replace `~/.claude/hooks/` with `.claude/hooks/`.

## Enable / Disable after install

### Hooks

To **disable** a specific hook, remove its entry from `settings.json`:

| Hook | Event | Disable by removing |
|------|-------|---------------------|
| `suggest-compact` | PreToolUse | matcher `""` entry under `hooks.PreToolUse` |
| `doc-file-warning` | PreToolUse | matcher `"Write"` entry under `hooks.PreToolUse` |
| `pre-compact` | PreCompact | the `hooks.PreCompact` block |
| `desktop-notify` | Stop | the `desktop-notify` command under `hooks.Stop` |
| `cost-tracker` | Stop | the `cost-tracker` command under `hooks.Stop` |

To **disable all hooks** from this preset temporarily, remove the `hooks` key from `settings.json`.

### mgrep plugin

| Action | How |
|--------|-----|
| Disable | Remove `"mgrep@Mixedbread-Grep": true` from `enabledPlugins` in `~/.claude/settings.json` |
| Re-enable | Add `"mgrep@Mixedbread-Grep": true` back, or run `/plugins install mgrep@Mixedbread-Grep` |

### Full uninstall

```bash
pnpm uninstall core
```

## Install

```bash
# User level (recommended — applies to all projects):
pnpm install:user core --force --symlink

# Project level (this project only):
pnpm install:project core --force --symlink
```
