# ai-native

Extends `core` with AI self-learning and skill creation. Designed for users who want
Claude to observe their workflow, extract reusable patterns, and improve over time.

**Inherits all components from [`core`](../core/README.md).**

## Who should use this

Anyone who wants Claude to actively learn from their sessions and build a personal
knowledge base of instincts and skills. Stack-agnostic — the learning is about
*how you work*, not what you work on.

## Components (additional to core)

| Type | Name | Purpose |
|------|------|---------|
| skill | `continuous-learning-v2` | Extracts atomic instincts with confidence scoring. Project-scoped by default (v2.1). Hooks are **opt-in** — wire manually after install. |
| skill | `skill-creator` | Create and improve skills directly from conversation — turns observed patterns into reusable commands. |

## Hook wiring (opt-in)

The `continuous-learning-v2` observer hooks are **not auto-wired** — the preset installs
the skill only. To activate observation, add the hooks manually to your
`~/.claude/settings.json` (user-level install):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "~/.claude/skills/continuous-learning-v2/hooks/observe.sh pre" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "~/.claude/skills/continuous-learning-v2/hooks/observe.sh" }]
      }
    ]
  }
}
```

For **project-level** install, replace `~/.claude/skills/` with `.claude/skills/`.

> **Note:** The observer is **disabled by default** in `config.json` inside the skill folder.
> Enable it after install by editing `~/.claude/skills/continuous-learning-v2/config.json`:
> ```json
> { "observer": { "enabled": true } }
> ```

## Enable / Disable after install

### Hooks

| Hook | Event | Disable by removing |
|------|-------|---------------------|
| `observe.sh pre` | PreToolUse | the `observe.sh pre` entry under `hooks.PreToolUse` |
| `observe.sh` | PostToolUse | the `observe.sh` entry under `hooks.PostToolUse` |

To **disable all observation** temporarily without uninstalling:
- Either remove both hook entries from `settings.json`, or
- Set `"enabled": false` in `~/.claude/skills/continuous-learning-v2/config.json`

### Re-enable observer

```bash
# Edit config to re-enable
$EDITOR ~/.claude/skills/continuous-learning-v2/config.json
# set "enabled": true
```

### Full uninstall

```bash
pnpm uninstall ai-native
```

## Install

```bash
# User level (recommended — applies to all projects):
pnpm install:user ai-native --force --symlink

# Project level (this project only):
pnpm install:project ai-native --force --symlink
```
