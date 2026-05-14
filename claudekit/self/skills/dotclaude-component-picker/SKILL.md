---
name: dotclaude-component-picker
description: Use when picking, vendoring, porting, or syncing agents, skills, commands, hooks, or rules from any upstream source (ECC = everything-claude-code, anthropic-skills, claude-code plugins, mcp-servers, wshobson/agents, or other external repos) into this dotclaude project's claudekit/ directory. Trigger on phrases like "pick X from ECC", "vendor this skill", "add agent from upstream", "port this component", "sync component from source", "import this hook", "bring in this rule from ECC", "vendor from claude-code", or any time the user references an upstream component to add to claudekit/. This skill covers the full 8-step pipeline: browse → evaluate → cross-reference scan → vendor → sidecar → preset → install → verify. Also trigger for upgrade or sync tasks ("check if X has updates", "sync X from upstream").
---

# dotclaude-component-picker

Full pipeline for picking a component from any upstream source and integrating it into `dotclaude`. Follow all 8 steps — each step's output feeds the next.

**Bundled references** (read when you need the full schema or deeper context):
- `references/sidecar.md` — sidecar schema, layout rules, dependency resolution, modify/upgrade workflows
- `references/presets.md` — preset schema, extends: semantics, settings_patch, install flags

---

## Upstream Sources

| Alias | Submodule path | Available component types |
|---|---|---|
| ECC | `upstream/everything-claude-code/` | agents, skills, commands, hooks, rules |
| anthropic-skills | `upstream/anthropic-skills/` | skills |
| claude-code | `upstream/claude-code/plugins/<name>/` | agents, skills, commands, hooks (nested in plugins) |
| mcp-servers | `upstream/mcp-servers/` | reference only |
| anthropic-cookbook | `upstream/anthropic-cookbook/` | reference only |

**Note for claude-code:** components live inside `plugins/<plugin-name>/.claude-plugin/` (not top-level). Browse with:
```bash
ls upstream/claude-code/plugins/
ls upstream/claude-code/plugins/<name>/.claude-plugin/
cat upstream/claude-code/plugins/<name>/.claude-plugin/plugin.json
```

---

## Step 1 — Browse

First, bring the submodule to the latest remote state:

```bash
git submodule update --remote upstream/<alias>
```

Then survey what's available and what's already vendored:

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

Note: component name, whether it's a **folder** or **file** component, and whether it already exists in `claudekit/`. If it already exists, compare commits and decide whether to upgrade (see Upgrade workflow in `references/sidecar.md`).

---

## Step 2 — Evaluate

Read the component's primary documentation:
- **Skill folder**: read `SKILL.md` inside the folder
- **Agent / command / rule**: read the `.md` file
- **Hook**: read the script header / inline comments

Confirm before vendoring:
1. License is compatible — look for `LICENSE.txt` in the component folder or the upstream root
2. Not already vendored — if it is, compare commits (`pnpm sync <type>/<name>`) and decide whether to upgrade
3. External dependencies (python3, npm packages, binaries) — note them; they go in `dependencies.external`
4. Internal dependencies (other skills, hooks, agents this component requires) — identified in Step 2.5 below

### Step 2f — Coverage assessment

Evaluate how broadly the component applies across languages/stacks. Record findings — they go into the sidecar in Step 4.

**Signals that indicate language-specific coverage:**
- Bash commands call `npm`, `npx`, `jest`, `vitest`, `pip`, `pytest`, `cargo`, `go test`, `mvn` — language/runtime-specific
- All code examples are in one language/framework (TypeScript + Next.js, Python + FastAPI, etc.)
- Import statements or config files are ecosystem-specific (`package.json`, `requirements.txt`, `go.mod`)

**Coverage verdicts:**

| Verdict | When | Sidecar value |
|---|---|---|
| `js-only` | Tooling or commands require npm/Node/Jest — will fail on non-JS projects | `coverage: [js-only]` |
| `js-example-heavy` | Concept is cross-stack but all worked examples use TypeScript/JS | `coverage: [js-example-heavy]` |
| `python-only`, `go-only` etc. | Analogous to js-only for other stacks | `coverage: [<lang>-only]` |
| universal | No language-specific tooling or examples | omit `coverage` |

**Tag to add when relevant:**
- `js-specific` (or `python-specific`, etc.) — if the tooling itself is language-locked
- `framework-preset-candidate` — if the component is best suited for a language-specific framework preset rather than a cross-stack core preset

---

## Step 2.5 — Cross-Reference & Dependency Scan

This step ensures the component's dependencies are correctly mapped and met before vendoring. Do it every time, even when the component looks self-contained — the scan often surfaces shared scripts or implicit skill invocations.

### 2.5a — Scan the component for references

Run these greps against the component's source in upstream (before copying):

```bash
COMP=upstream/<alias>/<type>/<name>   # e.g. upstream/anthropic-skills/skills/docx

# References to other skills/agents by name
grep -rni "skill\|agent\|use_skill\|invoke\|require\|depends" "$COMP/" | grep -v "LICENSE\|\.yaml:"

# Python imports that might pull from other claudekit components
grep -rn "^from \.\|^import \." "$COMP/scripts/" 2>/dev/null

# Shell scripts calling other claudekit hooks or commands
grep -rn "\.sh\b\|source \." "$COMP/" 2>/dev/null | grep -v "^Binary\|LICENSE"

# Detect shared scripts — compare subtrees with existing claudekit components
for candidate in claudekit/skills/*/scripts/ claudekit/hooks/; do
  diff -rq "$COMP/scripts/" "$candidate" 2>/dev/null && echo "IDENTICAL to $candidate"
done
```

### 2.5b — For each reference found, apply this decision matrix

| Situation | Action |
|---|---|
| Referenced component **not in `claudekit/`**, exists in upstream | Vendor it first (loop back to Step 1 for that component). Then add to `dependencies.required`. |
| Referenced component **already in `claudekit/`**, same upstream source & commit range | Confirm it's current. Add to `dependencies.required`. No further action. |
| Referenced component **already in `claudekit/`**, different upstream or diverged commit | Inspect the divergence: if the interface/API matches what this component needs, add to `dependencies.required` and note the divergence in `notes:`. If it conflicts, vendor a renamed copy or resolve before proceeding. |
| Reference is **optional** (skill degrades gracefully without it) | Add to `dependencies.optional`. |
| Reference is an **external binary/package** (python3, node, soffice) | Add to `dependencies.external` with `type` and `reason`. |
| Reference not traceable to any upstream source | Add to `dependencies.external` with `type: unknown` and document in `notes:`. |

### 2.5c — Shared-code pattern

When a component's `scripts/` subtree is **identical** to an existing claudekit component (e.g., `docx`, `xlsx`, and `pptx` all duplicate `scripts/office/`):

- **This is upstream design** — each skill is intentionally self-contained
- Do **not** create an artificial shared dependency or symlink between them
- Note it in the sidecar's `notes:` field so future upgraders know to sync all affected skills together: `"scripts/office/ is identical to docx and pptx — sync together"`
- If only **partial** overlap exists (some files shared, some diverged), document exactly which files differ and why

### 2.5d — Verify existing claudekit components used as dependencies

When a dependency is already in `claudekit/` and you're about to declare it in `dependencies.required`:

1. **Check source alignment**: does the existing sidecar's `source.repo` match where this component expects to pull from?
   ```bash
   cat claudekit/<type>/<dep-name>/SOURCE.yaml | grep "repo\|commit"
   ```
2. **Check purpose alignment**: does the existing component's stated purpose (sidecar `notes:`) cover what the new component needs?
3. **If aligned** → add to `dependencies.required`, no further work
4. **If diverged** → note divergence in both sidecars' `notes:` fields, confirm the interface still works, then proceed

### 2.5e — Source script import/require scan (hooks and JS/TS scripts)

Run this scan whenever the component includes `.js` or `.ts` source files:

```bash
COMP=upstream/<alias>/<type>/<name>   # or claudekit/<type>/<name> after vendoring

# CommonJS — relative local requires
grep -rn "require('\." "$COMP/" 2>/dev/null | grep -v "node_modules"

# ESM — relative local imports
grep -rn "^import .* from '\." "$COMP/" 2>/dev/null

# Relative imports going UP the tree (cross-dir dependencies)
grep -rn "require('\.\." "$COMP/" 2>/dev/null
grep -rn "^import .* from '\.\." "$COMP/" 2>/dev/null

# External npm packages (non-relative, non-builtin)
grep -rn "require('[^./]" "$COMP/" 2>/dev/null | grep -v "require('node:"
grep -rn "^import .* from '[^./]" "$COMP/" 2>/dev/null | grep -v "from 'node:"
```

Decision matrix for each import/require found:

| Pattern | Meaning | Action |
|---|---|---|
| `require('./lib/...')` or `import from './lib/...'` | Shared lib subdir inside same component-type dir (e.g. `hooks/lib/`) | Verify `claudekit/hooks/lib/` exists. The installer **auto-copies `hooks/lib/`** in copy mode — no manual step needed at install time. Still vendor the lib files into claudekit if not present. Note in sidecar: `"Requires hooks/lib/utils — co-installed automatically"`. |
| `require('./other-file')` within same dir | Intra-type sibling dependency | Vendor the referenced file too. Add to `dependencies.required.<type>`. |
| `require('../...')` going up the tree | Cross-dir dependency — won't resolve after copy/install | **Flag immediately.** The installed file won't have this relative path structure. Either the component must be self-contained or the path must be rewritten. Note under `modifications:` in the sidecar. |
| `require('some-npm-pkg')` (non-relative, non-`node:`) | External npm package | Add to `dependencies.external` with `type: npm` and `reason`. |
| `require('node:fs')`, `require('fs')`, `require('path')` etc. | Node.js built-in | No action needed. |
| `require('child_process')`, `require('os')` etc. | Node.js built-in (old-style) | No action needed. |

**`hooks/lib/` pattern — known shared runtime:**  
`claudekit/hooks/lib/` contains shared utilities (`utils.js`, `hook-flags.js`, etc.) used by nearly all hooks via `require('./lib/utils')`. When vendoring a hook that references `./lib/`, confirm these files are present in `claudekit/hooks/lib/`. The installer handles co-copying automatically since 2026-05-12 — but vendoring still requires the files to exist in `claudekit/hooks/lib/` as source.

---

## Step 3 — Vendor

Get the upstream commit hash first — you need it for the sidecar:

```bash
git -C upstream/<alias> rev-parse HEAD
```

**Folder component** (skill with SKILL.md + assets, multi-file agent):
```bash
cp -r upstream/<alias>/<type>/<name>/ claudekit/<type>/<name>/
```

**File component** (single `.md` agent, single command, hook script):
```bash
cp upstream/<alias>/<type>/<name>.md claudekit/<type>/<name>.md
# or for shell scripts:
cp upstream/<alias>/<type>/<name>.sh claudekit/<type>/<name>.sh
```

If Step 2.5 identified dependencies not yet in `claudekit/`, vendor those first before vendoring the primary component.

---

## Step 4 — Sidecar

The sidecar records provenance and drives dependency resolution at install time. Read `references/sidecar.md` for the full schema — here's the quick version.

**Sidecar location:**
- **Folder component** → `SOURCE.yaml` **inside** the folder: `claudekit/<type>/<name>/SOURCE.yaml`
- **File component** → `<name>.source.yaml` **next to** the file: `claudekit/<type>/<name>.source.yaml`

**Minimal template** (see `references/sidecar.md` for all fields including tags/categories):

```yaml
# yaml-language-server: $schema=../../../presets/schema/sidecar.schema.json
source:
  repo: https://github.com/<org>/<repo>   # no trailing .git
  commit: <40-char-hex>                   # from `git -C upstream/<alias> rev-parse HEAD`
  path: <type>/<name>                     # path within upstream repo
  ref: main
imported_at: "<YYYY-MM-DD>"              # quoted — bare dates get parsed as Date objects
license: MIT
modified: false
modifications: null
notes: >-
  What the component does, key files, any quirks for future sync decisions.
  If scripts/office/ (or similar) is shared with other skills, note it here.
dependencies:
  required:
    agents: []
    skills: []       # populated from Step 2.5 scan results
    commands: []
    hooks: []
    rules: []
  optional:
    agents: []
    skills: []
    commands: []
    hooks: []
    rules: []
  external: []       # system binaries / PyPI / npm packages
tags: []
categories: {}
```

**External dependency format:**
```yaml
external:
  - name: python3
    type: system_binary       # npm | system_binary | python_pkg
    reason: "scripts/*.py require Python 3.9+"
  - name: claude
    type: system_binary
    reason: "calls claude -p via subprocess"
```

**Populate `tags` and `categories` from Step 2f findings:**

```yaml
tags:
  - js-specific              # add if tooling is npm/Jest/etc. locked (from Step 2f)
  - framework-preset-candidate  # add if better suited for a language-specific preset
  # other descriptive tags (nodejs, typescript, jest, vitest, playwright, etc.)
categories:
  stacks:
    - nodejs                 # list applicable stacks from Step 2f
    - typescript
  coverage:
    - js-only                # or js-example-heavy, python-only, go-only — from Step 2f verdict
                             # omit coverage entirely if universal
```

If the sidecar `notes` field names a cross-language alternative (e.g., "use security-bounty-hunter for non-JS projects"), this is the signal that `preset-wizard` and `dotclaude-setup` will use to auto-propose replacements — write it explicitly.

**After creating the sidecar**, verify it parses correctly:
```bash
pnpm typecheck
```

**If you later edit the vendored component**, set `modified: true` and add a `modifications:` description — this is how the sync tool knows the local copy diverges from upstream.

---

## Step 5 — Preset

Add the component to an existing preset or create a new one. Read `references/presets.md` for the full schema.

**Coverage pre-check before adding to a preset:**

Read the sidecar (`SOURCE.yaml` / `<name>.source.yaml`) for the component being added. Check `categories.coverage` and `tags`:

| Sidecar signal | Target preset kind | Action |
|---|---|---|
| `coverage: [js-only]` or tag `js-specific` | `core` / cross-stack | ⚠ Warn: "This component is JS-specific. Sidecar notes suggest: `<alternative from notes>`" — confirm with user before adding |
| `coverage: [js-only]` or tag `js-specific` | `framework` with matching stack | ✓ Proceed — good fit |
| tag `framework-preset-candidate` | `core` / cross-stack | 📌 Note: "Better placed in a `framework/<stack>` preset" — confirm intent |
| `coverage: [js-example-heavy]` | `core` / cross-stack | ℹ Note: "Examples are JS-focused but concept applies broadly" — no block |
| No coverage signal | any | ✓ Proceed |

**Add to an existing preset** — edit the `.yaml` in `presets/`:
```yaml
components:
  skills:
    - <name>    # or agents:, commands:, hooks:, rules:
```

**Create a new preset** — copy an existing one as a template:
```bash
KIND=core   # or: framework, purpose
NAME=<preset-name>
mkdir -p presets/$KIND/$NAME
cp presets/core/developer/preset.yaml presets/$KIND/$NAME/preset.yaml
cp presets/core/developer/README.md   presets/$KIND/$NAME/README.md
$EDITOR presets/$KIND/$NAME/preset.yaml  # update name/kind/description/components/tags
```

Validate the preset:
```bash
pnpm validate <preset-name> --kind <core|framework|purpose>
```

---

## Step 6 — Install

```bash
# Into this project (.claude/ at repo root)
pnpm install:project <preset-name> --symlink --force

# Into user-level (~/.claude/)
pnpm install:user <preset-name> --symlink --force
```

`--force` overwrites in-place without creating `.bak` backups. `--symlink` keeps the installed component as a pointer back to `claudekit/` (edits to the source are immediately live).

> **Pitfall**: `pnpm install <preset>` is intercepted by pnpm as an npm install. Always use `pnpm install:project` or `pnpm install:user`.

If the preset has a `settings_patch` (e.g., hooks), the installer merges it into `.claude/settings.json` automatically. Check the result:
```bash
cat .claude/settings.json
```

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

One commit per vendor operation — keep them small and easy to revert:

```bash
git add claudekit/<type>/<name>/ presets/<kind>/<preset>.yaml presets/<kind>/<preset>.md
git commit -m "feat(<type>): vendor <name> from <upstream-alias>"
```

Conventional commits, English headers. Do not bundle multiple unrelated vendors in one commit.

---

## Upgrade an existing component

If a component is already in `claudekit/` and you want to pull upstream changes:

```bash
pnpm sync <type>/<name>          # shows diff between sidecar.commit and upstream HEAD
# Review diff, manually merge desired changes into claudekit/<type>/<name>/
# Then update sidecar: bump source.commit, set modified: true if diverged
pnpm typecheck && pnpm test
```
