# Picking `code-reviewer` from ECC → `dotclaude-self` preset

Following the 8-step dotclaude-component-picker pipeline.

---

## Step 1 — Browse

```bash
git submodule update --remote upstream/everything-claude-code
```

Scanning ECC agents available: `a11y-architect.md`, `architect.md`, `code-reviewer.md`, `code-simplifier.md`, … (file component — single `.md`)

Already in `claudekit/agents/`:
- `code-reviewer.md` ✅ already vendored
- `code-reviewer.source.yaml` ✅ sidecar present

**`code-reviewer` is already vendored.** Current sidecar commit: `841beea45cb25ba51f29fa45b7e272938d19b80a`  
ECC HEAD: `841beea45cb25ba51f29fa45b7e272938d19b80a`

**Same commit** — no upstream changes since last import. The task is to add it to `dotclaude-self`, not re-vendor it.

---

## Step 2 — Evaluate (already vendored, upgrade not needed)

The existing sidecar already captures the evaluation:
- License: MIT ✅
- External deps: none ✅
- Internal deps: `skills: [coding-standards]` — already in claudekit ✅

Since the component is at HEAD and unchanged, we skip vendor/sidecar and go straight to checking the dependency.

---

## Step 2.5 — Cross-Reference & Dependency Scan

Running the scan on the ECC upstream source for completeness (even though already vendored):

```bash
COMP=upstream/everything-claude-code/agents/code-reviewer.md

grep -ni "skill|agent|use_skill|invoke|require|depends" "$COMP" | grep -v "LICENSE"
```

**Scan results:**
- Line 12: `"When invoked:"` — self-invocation description, not a dependency reference
- Line 219: `"Immutability requirements"` — code style content, not a dependency

No skill/agent/hook cross-references found in the markdown body.

**Step 2.5d — Verify existing dependency (`coding-standards`):**

The existing sidecar already declares `dependencies.required.skills: [coding-standards]`. Checking alignment:

```bash
cat claudekit/skills/coding-standards/SOURCE.yaml | grep "repo|commit"
# → repo: https://github.com/affaan-m/everything-claude-code
# → commit: 841beea45cb25ba51f29fa45b7e272938d19b80a
```

Same upstream repo and commit as `code-reviewer` — **fully aligned** ✅.  
`coding-standards` already in `claudekit/skills/` ✅. No action needed.

**Scan conclusion:** No new dependencies discovered. Existing sidecar is accurate.

---

## Step 3 — Vendor

**Skipped** — component already at HEAD in `claudekit/agents/code-reviewer.md`.

---

## Step 4 — Sidecar

**No changes needed** — existing `code-reviewer.source.yaml` is accurate:

```yaml
# yaml-language-server: $schema=../../presets/schema/sidecar.schema.json
source:
  repo: https://github.com/affaan-m/everything-claude-code
  commit: 841beea45cb25ba51f29fa45b7e272938d19b80a
  path: agents/code-reviewer.md
  ref: main
imported_at: 2026-05-08
license: MIT
modified: false
modifications: null
notes: First agent vendored Phase 1 to verify provenance + deps flow end-to-end.
dependencies:
  required:
    agents: []
    skills:
      - coding-standards
    commands: []
    hooks: []
    rules: []
  optional:
    agents: []
    skills: []
    commands: []
    hooks: []
    rules: []
  external: []
tags:
  - code-review
  - quality
categories:
  purpose:
    - review
  stack:
    - cross-stack
```

---

## Step 5 — Preset

`dotclaude-self` preset (`presets/purpose/dotclaude-self.yaml`) currently has:

```yaml
components:
  agents: []
  skills:
    - continuous-learning-v2
    - dotclaude-component-picker
    - skill-creator
```

**Add `code-reviewer` to `components.agents`:**

```yaml
components:
  agents:
    - code-reviewer
  skills:
    - continuous-learning-v2
    - dotclaude-component-picker
    - skill-creator
```

Then validate:
```bash
pnpm validate dotclaude-self --kind purpose
```

---

## Step 6 — Install

```bash
pnpm install:project dotclaude-self --symlink --force
```

This installs `code-reviewer` as a symlink at `.claude/agents/code-reviewer.md` and also re-installs the skills (idempotent). The resolver will also pull in `coding-standards` as a required dependency of `code-reviewer`.

---

## Step 7 — Verify

```bash
pnpm validate dotclaude-self --kind purpose
pnpm typecheck && pnpm test
```

Confirm:
- `.claude/agents/code-reviewer.md` → symlink to `claudekit/agents/code-reviewer.md` ✅
- `.claude/skills/coding-standards/` → installed (required dep) ✅

---

## Commit

```bash
git add presets/purpose/dotclaude-self.yaml
git commit -m "feat(preset): add code-reviewer agent to dotclaude-self"
```

---

**Summary:** `code-reviewer` was already vendored at the correct commit. Step 2.5 confirmed the existing sidecar dependency (`coding-standards`) is correctly aligned. Only change needed: add `code-reviewer` to `dotclaude-self.yaml` components, then re-install and verify.
