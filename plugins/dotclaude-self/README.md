# dotclaude-self

Full working environment for the dotclaude repo itself. Includes preset authoring
wizards, self-learning, component picker, and skill creator. Install this when you
have cloned the dotclaude repo and want to work inside it — no need to also install
`dotclaude-bootstrap` separately.

## What's included

| Type | Name | Purpose |
|------|------|---------|
| command | `/dotclaude-setup` | Bootstrap wizard for end-users new to dotclaude |
| command | `/preset-wizard` | Create a new preset from scratch |
| skill | `preset-debugger` | Diagnose and fix broken presets/plugins |
| skill | `plugin-discovery` | Search GitHub for external components to vendor |
| skill | `dotclaude-component-picker` | Full 8-step vendor pipeline from upstream |
| skill | `skill-creator` | Create and eval new skills |
| skill | `continuous-learning-v2` | Session observation → atomic instincts |

## Install

```bash
# From inside the dotclaude repo:
pnpm install:project dotclaude-self --force --symlink
```

Install at **project level** (`.claude/`) — this preset is specific to the dotclaude
repo itself, not meant for user-wide use.

## Post-install checklist

1. Init homunculus dirs:
   ```bash
   mkdir -p ~/.claude/homunculus/{instincts/{personal,inherited},evolved/{agents,skills,commands},projects}
   ```
2. Wire the observer hooks (see [§ Hook wiring](#hook-wiring) below).
3. Enable the background observer in `.claude/skills/continuous-learning-v2/config.json`:
   ```json
   { "observer": { "enabled": true } }
   ```
4. Verify hooks fire: trigger any tool use, then check `~/.claude/homunculus/projects/*/observations.jsonl`

## Hook wiring

Add to `.claude/settings.json` (this preset is always project-level):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": ".claude/skills/continuous-learning-v2/hooks/observe.sh pre" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": ".claude/skills/continuous-learning-v2/hooks/observe.sh" }]
      }
    ]
  }
}
```

> The observer script is **disabled by default** via `config.json` — wiring the hooks is safe before enabling.
> Enable observation only after step 3 of the post-install checklist above.

## Wizard commands (after install)

| Command | Description |
|---|---|
| `/dotclaude-setup` | Bootstrap a new end-user — detect/clone dotclaude, find preset, install |
| `/preset-wizard` | Interactive wizard to create a new dotclaude preset |

## Self-learning commands (after install)

| Command | Description |
|---|---|
| `/instinct-status` | Show project + global instincts with confidence scores |
| `/evolve` | Cluster instincts into skills/commands/agents |
| `/promote` | Promote project instincts to global scope |
| `/projects` | List all known projects and instinct counts |

## Relationship to dotclaude-bootstrap

`dotclaude-bootstrap` is a minimal subset (wizard commands + skills only, no
self-learning) designed for end-users who install dotclaude presets on their own
machines. `dotclaude-self` is the superset for developing and maintaining dotclaude
itself.
