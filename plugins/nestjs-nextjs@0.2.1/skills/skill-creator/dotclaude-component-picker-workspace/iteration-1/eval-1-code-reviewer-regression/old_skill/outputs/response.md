# Picking code-reviewer from ECC — Old Skill (7-step pipeline)

## Step 1 — Browse

```bash
git submodule update --remote upstream/everything-claude-code
```

**Available in upstream/everything-claude-code/agents/:**
- code-reviewer.md ✓ (file component, single .md)
- architect.md, build-error-resolver.md, ... (many others)

**Already vendored in claudekit/agents/:**
- code-reviewer.md ← **already exists**
- code-reviewer.source.yaml

`code-reviewer` is already vendored. Checking sidecar commit vs upstream HEAD:
- Sidecar commit: `841beea45cb25ba51f29fa45b7e272938d19b80a`
- Upstream HEAD: `841beea45cb25ba51f29fa45b7e272938d19b80a`

**Commits match** — the vendored copy is up to date with upstream. No upgrade needed.

Since it's already vendored and up to date, the main remaining task is adding it to the `dotclaude-self` preset (if it isn't there already).

---

## Step 2 — Evaluate

Read `upstream/everything-claude-code/agents/code-reviewer.md`:

- **Type**: file component (single `.md`)
- **Purpose**: Expert code review — checks quality, security, maintainability. Invokes after writing/modifying code.
- **License**: MIT (ECC repo root)
- **External dependencies**: none (uses Read, Grep, Glob, Bash tools only)
- **Internal dependencies**: references `coding-standards` skill (already noted in existing sidecar `dependencies.required.skills: [coding-standards]`)

Existing sidecar already has `coding-standards` in `dependencies.required.skills`. No changes needed to the component itself.

---

## Step 3 — Vendor

Already vendored at correct commit — skip copy step.

---

## Step 4 — Sidecar

Existing `claudekit/agents/code-reviewer.source.yaml` is correct and up to date:

```yaml
source:
  repo: https://github.com/affaan-m/everything-claude-code
  commit: 841beea45cb25ba51f29fa45b7e272938d19b80a
  path: agents/code-reviewer.md
  ref: main
imported_at: "2026-05-08"
license: MIT
modified: false
modifications: null
notes: First agent vendored Phase 1 to verify provenance + deps flow end-to-end.
dependencies:
  required:
    skills:
      - coding-standards
  external: []
```

No changes needed.

---

## Step 5 — Preset

The user asked to add to `dotclaude-self` preset. That preset doesn't exist yet — need to create it. Using `personal-baseline` as template:

```bash
cp presets/core/personal-baseline.yaml presets/core/dotclaude-self.yaml
cp presets/core/personal-baseline.md   presets/core/dotclaude-self.md
```

Edit `presets/core/dotclaude-self.yaml`:

```yaml
name: dotclaude-self
kind: core
description: Preset for working on the dotclaude project itself.
version: 0.1.0
extends: []
components:
  agents:
    - code-reviewer
  skills:
    - coding-standards
  commands: []
  hooks: []
  rules: []
settings_patch: {}
tags:
  - dotclaude
  - self
```

```bash
pnpm validate dotclaude-self --kind core
```

---

## Step 6 — Install

```bash
pnpm install:project dotclaude-self --symlink --force
```

Check `.claude/settings.json` for any settings_patch merge (none in this case).

---

## Step 7 — Verify

```bash
pnpm validate dotclaude-self --kind core
pnpm typecheck && pnpm test
```

Confirm symlinks exist:
- `.claude/agents/code-reviewer.md` → `claudekit/agents/code-reviewer.md`

---

## Commit

```bash
git add presets/core/dotclaude-self.yaml presets/core/dotclaude-self.md
git commit -m "feat(preset): add dotclaude-self preset with code-reviewer agent"
```

---

## Summary

`code-reviewer` was already vendored at the correct commit. Created new `dotclaude-self` preset and added the agent to it. The existing sidecar already correctly notes `coding-standards` as a required skill dependency.

**Gap in old skill**: Step 2 mentions noting internal dependencies but gives no systematic process for *finding* them from the component content. The `coding-standards` dependency was already in the sidecar from a prior import — the old skill would not have guided us to discover it if starting fresh.
