# Sidecar Reference

> Condensed from `docs/PROVENANCE.md`. Read the full doc for edge cases and sync workflow.

## Layout rules

**File-component** (agent / command / hook / rule — single `.md` or `.sh`):
```
claudekit/agents/code-reviewer.md          ← component
claudekit/agents/code-reviewer.source.yaml ← sidecar (base name matches, .source.yaml suffix)
```

**Folder-component** (skill — folder containing SKILL.md + assets):
```
claudekit/skills/my-skill/
├── SKILL.md
├── SOURCE.yaml   ← sidecar (always named SOURCE.yaml, INSIDE the folder)
└── ...
```

The installer **excludes SOURCE.yaml** when copying a folder to a target. Never put a SOURCE.yaml outside the folder for folder-components.

## Full schema (copy-paste template)

```yaml
# yaml-language-server: $schema=../../../presets/schema/sidecar.schema.json
#
# Adjust the relative $schema path:
#   - skills/<name>/SOURCE.yaml     → ../../../presets/schema/sidecar.schema.json
#   - agents/<name>.source.yaml     → ../../presets/schema/sidecar.schema.json
#   - commands/<name>.source.yaml   → ../../presets/schema/sidecar.schema.json
source:
  repo: https://github.com/<org>/<repo>   # exact HTTPS URL, no trailing .git
  commit: <40-char-hex>                   # full SHA from `git -C upstream/<alias> rev-parse HEAD`
  path: <type>/<name>                     # path within the upstream repo (no leading slash)
  ref: main                               # branch being tracked
imported_at: "<YYYY-MM-DD>"              # today's date, quoted string (js-yaml parses bare dates as Date objects)
license: MIT                              # actual license (MIT, Apache-2.0, etc.)
modified: false                           # true if the owner has edited this file post-import
modifications: null                       # required description when modified: true
notes: >-
  One paragraph: what the component does, key files/scripts, any quirks relevant
  to future sync or upgrade decisions.
dependencies:
  required:                               # auto-installed by resolver on install
    agents: []
    skills: []
    commands: []
    hooks: []
    rules: []
  optional:                               # skipped by default; --include-optional to include
    agents: []
    skills: []
    commands: []
    hooks: []
    rules: []
  external:                               # probed only (warn if missing), not auto-installed
    - name: python3
      type: system_binary                 # npm | system_binary | python_pkg
      version: ">=3.9"                    # optional version constraint
      reason: "why this binary is needed"
    - name: claude
      type: system_binary
      reason: "calls claude -p via subprocess for description optimization"
tags:                                     # flat labels for search/filter (CQ-13)
  - learning
  - hooks
categories:                              # grouped by dimension (CQ-13)
  purpose:
    - learning
    - automation
  mechanism:
    - hooks
    - background-agent
```

## Key constraints (enforced by zod schema)

- `commit` must be exactly 40 hex characters (full SHA, not abbreviated)
- `imported_at` must be `YYYY-MM-DD` format (quoted string in YAML to avoid Date parsing)
- `repo` must be a valid HTTPS URL
- `modified` is boolean (not the string `"true"`)
- `modifications` and `notes` are `string | null` — never omit entirely (use `null`)

## Dependency resolution behavior

- **required**: resolver auto-includes them recursively (A → B → C are all installed). Circular → error. Diamond → deduped.
- **optional**: logged but skipped. Owner passes `--include-optional` to install.
- **external**: probed at install time (which/pip show/pnpm ls). Logged FOUND/NOT FOUND. Never auto-installed.

## Modify workflow

After editing a vendored file in `claudekit/`:
```yaml
modified: true
modifications: |
  - Removed ECC-specific intro line.
  - Added dotclaude-specific section on X.
```

Update `modifications` on every subsequent edit — it's a running diff summary.

## Upgrade workflow

```bash
# Diff sidecar.commit ↔ upstream HEAD for a specific component
pnpm sync agents/code-reviewer    # or skills/my-skill

# If you adopt changes: manually merge → update sidecar commit hash + modified flag
```

`pnpm sync` is diff-only — it never auto-applies.
