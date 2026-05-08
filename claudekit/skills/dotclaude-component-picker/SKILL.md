---
name: dotclaude-component-picker
description: Use when picking, vendoring, porting, or syncing agents, skills, commands, hooks, or rules from any upstream source (ECC = everything-claude-code, anthropic-skills, mcp-servers, wshobson/agents, or other external repos) into this dotclaude project's claudekit/ directory. Trigger on phrases like "pick X from ECC", "vendor this skill", "add agent from upstream", "port this component", "sync component from source", "import this hook", "bring in this rule from ECC", or any time the user references an upstream component to add to claudekit/. This skill covers the full 7-step pipeline: browse → evaluate → vendor → sidecar → preset → install → verify.
---

# dotclaude-component-picker

Full pipeline for picking a component from any upstream source and integrating it into `dotclaude`. Follow all 7 steps — each step's output feeds the next.

## Upstream Sources

| Alias | Submodule path | Available component types |
|---|---|---|
| ECC | `upstream/everything-claude-code/` | agents, skills, commands, hooks, rules |
| anthropic-skills | `upstream/anthropic-skills/` | skills |
| mcp-servers | `upstream/mcp-servers/` | reference only |
| anthropic-cookbook | `upstream/anthropic-cookbook/` | reference only |

Before starting, ensure the target submodule is up-to-date:

```bash
git submodule update --remote upstream/<alias>
```

---

## Step 1 — Browse

Survey what's available and what's already vendored:

```bash
# Available in upstream
ls upstream/<alias>/agents/
ls upstream/<alias>/skills/
ls upstream/<alias>/commands/
ls upstream/<alias>/hooks/

# Already vendored in claudekit
ls claudekit/agents/
ls claudekit/skills/
ls claudekit/commands/
ls claudekit/hooks/
```

Note: component name, whether it's a **folder** or **file** component, and whether it already exists in `claudekit/`.

---

## Step 2 — Evaluate

Read the component's primary documentation:
- **Skill folder**: read `SKILL.md` inside the folder
- **Agent / command / rule**: read the `.md` file
- **Hook**: read the script header / inline comments

Confirm before vendoring:
1. License is compatible (look for `LICENSE.txt` in the component folder or the upstream root)
2. Not already vendored — if it is, compare commits and decide whether to upgrade
3. External dependencies (python3, npm packages, binaries) — note them for the sidecar
4. Internal dependencies (other skills, hooks, agents) — note for the sidecar

---

## Step 3 — Vendor

Get the upstream commit hash first (needed for the sidecar):

```bash
git -C upstream/<alias> rev-parse HEAD
```

**Folder component** (skill with multiple files, multi-file agent):
```bash
cp -r upstream/<alias>/<type>/<name>/ claudekit/<type>/<name>/
```

**File component** (single `.md` agent, single command, hook script):
```bash
cp upstream/<alias>/<type>/<name>.md claudekit/<type>/<name>.md
# or for shell scripts:
cp upstream/<alias>/<type>/<name>.sh claudekit/<type>/<name>.sh
```

---

## Step 4 — Sidecar

Sidecar location depends on component type:
- **Folder component** → `SOURCE.yaml` **inside** the folder: `claudekit/<type>/<name>/SOURCE.yaml`
- **File component** → `<name>.source.yaml` **next to** the file: `claudekit/<type>/<name>.source.yaml`

Always add the schema comment at the top so IDEs validate it.

### Template

```yaml
# yaml-language-server: $schema=../../../presets/schema/sidecar.schema.json
#
# SOURCE.yaml is INSIDE the skill folder.
# Installer MUST exclude this file when copying the skill folder to a target.
source:
  repo: https://github.com/<org>/<repo>         # exact HTTPS URL (no trailing .git)
  commit: <40-char-hex>                          # from `git -C upstream/<alias> rev-parse HEAD`
  path: <type>/<name>                            # path within the upstream repo
  ref: main
imported_at: "<YYYY-MM-DD>"                      # today's date
license: MIT                                     # actual license of the component
modified: false
modifications: null
notes: >-
  <One paragraph: what the component does, key files, any quirks worth knowing
  for future sync or upgrade decisions.>
dependencies:
  required:
    agents: []
    skills: []
    commands: []
    hooks: []
    rules: []
  optional:
    agents: []
    skills: []
    commands: []
    hooks: []
    rules: []
  external: []                                   # fill in if there are system deps
tags: []
categories: {}
```

Fill `dependencies.external` for non-standard system dependencies:

```yaml
external:
  - name: python3
    type: system_binary       # or: npm, python_pkg
    reason: "why it's needed"
  - name: claude
    type: system_binary
    reason: "calls claude -p via subprocess"
```

After writing the sidecar, verify the schema:

```bash
pnpm typecheck
```

---

## Step 5 — Preset

Add the component reference to an existing preset, or create a new one.

**Add to existing preset** — edit the relevant `.yaml` in `presets/`:
```yaml
components:
  skills:
    - <name>    # or agents:, commands:, hooks:, rules:
```

**Create a new preset** — copy an existing one as a template:
```bash
KIND=core   # or: framework, purpose
NAME=<preset-name>
cp presets/core/personal-baseline.yaml presets/$KIND/$NAME.yaml
cp presets/core/personal-baseline.md   presets/$KIND/$NAME.md
$EDITOR presets/$KIND/$NAME.yaml
```

Validate the preset parses correctly:
```bash
pnpm validate <preset-name> --kind <core|framework|purpose>
```

---

## Step 6 — Install

```bash
# Into this project (.claude/ in the dotclaude repo)
pnpm install:project <preset-name>

# Into user-level Claude config (~/.claude/)
pnpm install:user <preset-name>
```

> **Pitfall**: never `pnpm install <preset>` — pnpm intercepts this as an npm install. Always use `pnpm install:project` or `pnpm install:user`.

If the preset patches `settings.json` hooks, the installer merges them automatically. Check `.claude/settings.json` after install to confirm the hooks landed correctly.

---

## Step 7 — Verify

```bash
pnpm validate <preset-name> --kind <kind>
pnpm typecheck && pnpm test
```

Confirm the component exists at its expected target location:
- Project install: `.claude/<type>/<name>/` or `.claude/<type>/<name>.md` (symlink or copy)
- User install: `~/.claude/<type>/<name>/`

---

## Commit

One commit per vendor operation (keep them small and easy to revert):

```bash
git add claudekit/<type>/<name>/ presets/<kind>/<preset>.yaml presets/<kind>/<preset>.md
git commit -m "feat(<type>): vendor <name> from <upstream-alias>"
```

Conventional commits, English headers. Do not bundle multiple unrelated vendors in one commit.
