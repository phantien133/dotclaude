# dotclaude-self

Installs `continuous-learning-v2` into this project and wires observation hooks so every Claude Code session contributes to a project-scoped instinct library.

## What it does

- Copies `continuous-learning-v2` skill to `.claude/skills/`
- Patches `.claude/settings.json` with `PreToolUse` + `PostToolUse` hooks that capture every tool call to `~/.claude/homunculus/projects/<project-hash>/observations.jsonl`
- Background observer (Haiku, opt-in via `config.json`) clusters observations into atomic instincts

## Post-install checklist

1. Init homunculus dirs:
   ```bash
   mkdir -p ~/.claude/homunculus/{instincts/{personal,inherited},evolved/{agents,skills,commands},projects}
   ```
2. Enable the background observer in `.claude/skills/continuous-learning-v2/config.json`:
   ```json
   { "observer": { "enabled": true } }
   ```
3. Verify hooks fire: trigger any tool use, then check `~/.claude/homunculus/projects/*/observations.jsonl`

## Commands (after install)

| Command | Description |
|---|---|
| `/instinct-status` | Show project + global instincts with confidence scores |
| `/evolve` | Cluster instincts into skills/commands/agents |
| `/promote` | Promote project instincts to global scope |
| `/projects` | List all known projects and instinct counts |
