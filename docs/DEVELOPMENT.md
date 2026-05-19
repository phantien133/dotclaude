# Development Guide

How to work inside this repo: vendor components, author presets, add upstream sources, and publish plugins.

For design decisions see [architecture.md](architecture.md). For sidecar schema see [PROVENANCE.md](PROVENANCE.md). For preset schema see [PRESETS.md](PRESETS.md).

> **Branch note:** all development work happens on `develop` / `hilab-develop`. The `master` / `hilab-master` branches contain only built plugin bundles and docs — see [Branch Strategy](#branch-strategy) at the bottom.

> **Claude Code first:** most workflows below have a dedicated skill or slash command. Use those instead of running shell commands manually — they handle the full pipeline, prompt for decisions, and validate the result.

---

## dotclaude-self components

The `dotclaude-self` preset (installed at `.claude/`) provides the authoring tooling for this repo:

| Component | Type | Trigger | What it does |
|-----------|------|---------|--------------|
| `dotclaude-component-picker` | skill | mention picking/vendoring any upstream component | Full 8-step pipeline: browse → evaluate → cross-reference → vendor → sidecar → preset → install → verify |
| `preset-wizard` | slash command `/preset-wizard` | creating a new preset | Interactive wizard: elicits requirements, proposes components, builds and verifies the preset |
| `plugin-discovery` | skill | finding external Claude Code components for dotclaude | Searches GitHub/npm for skills, agents, hooks, commands suitable for vendoring |
| `preset-debugger` | skill | preset fails to build, typecheck, or test | Diagnoses broken preset/plugin artifacts |
| `skill-creator` | skill | creating or optimizing a skill | Full lifecycle: scaffold, iterate, eval, benchmark |
| `dotclaude-setup` | slash command `/dotclaude-setup` | first-time setup or onboarding a new contributor | Bootstrap wizard: locate repo, pick preset, install |

Supporting skills available in any session:

| Skill | When it activates |
|-------|-------------------|
| `coding-standards` | Code review, naming, readability questions |
| `tdd-workflow` | Writing new features or fixing bugs — enforces RED → GREEN → refactor |
| `github-ops` | GitHub issue triage, PR management, CI ops via `gh` CLI |
| `doc-coauthoring` | Writing docs, proposals, technical specs |

---

## 1. Vendor a component from upstream

**Use the `dotclaude-component-picker` skill.** Open a Claude Code session in this repo and describe what you want to vendor — the skill handles the full 8-step pipeline.

Example prompts:
- *"pick the mcp-builder skill from everything-claude-code"*
- *"vendor the code-reviewer agent from ECC, evaluate it first"*
- *"sync dotclaude-component-picker from upstream — check if there are updates"*

The skill will: browse the upstream source, evaluate fit, scan for cross-references, copy the file(s) into the right `claudekit/<source>/` folder, create the sidecar, update a preset if needed, reinstall, and verify.

**Manual path** (if needed without Claude Code):

```bash
# Prerequisites: develop branch + submodules initialized
git submodule update --init --recursive

cp upstream/everything-claude-code/agents/<name>.md \
   claudekit/everything-claude-code/agents/<name>.md

git -C upstream/everything-claude-code rev-parse HEAD   # → pinned_commit for sidecar

# Create sidecar: claudekit/everything-claude-code/agents/<name>.source.yaml
# Reference in preset.yaml: components.agents: [{name: <name>, source: everything-claude-code}]

pnpm typecheck && pnpm test
```

See [PROVENANCE.md](PROVENANCE.md) for the sidecar schema.

---

## 2. Create or edit a preset

**Use `/preset-wizard`.** The wizard elicits requirements step by step, proposes matching components from `claudekit/`, builds the `preset.yaml`, and runs validation.

Example prompts after invoking `/preset-wizard`:
- *"I want a preset for a TypeScript monorepo — needs code review, testing, GitHub ops"*
- *"Add the mgrep skill to the existing developer preset"*

**Manual path:**

```bash
KIND=core   # or: framework, purpose
NAME=my-preset

mkdir -p presets/$KIND/$NAME
cp presets/core/developer/preset.yaml presets/$KIND/$NAME/preset.yaml
cp presets/core/developer/README.md   presets/$KIND/$NAME/README.md
$EDITOR presets/$KIND/$NAME/preset.yaml

pnpm validate $NAME --kind $KIND
```

Every component reference in `preset.yaml` is `{name, source}` — bare strings do not parse. Valid `source` aliases are in [CLAUDE.md § Source layout](../CLAUDE.md).

If the preset fails to build or validate, invoke the `preset-debugger` skill.

---

## 3. Find and evaluate new external components

**Use the `plugin-discovery` skill** to search for Claude Code components worth vendoring.

Example prompts:
- *"find external skills for database schema generation"*
- *"search GitHub for Claude Code hooks related to cost tracking"*
- *"discover MCP servers suitable for dotclaude"*

The skill searches GitHub (and optionally npm), evaluates fit against dotclaude conventions, and hands off to `dotclaude-component-picker` for vendoring.

---

## 4. Add a new upstream source

```bash
# 1. Add submodule
git submodule add <repo-url> upstream/<alias>

# 2. Record in dependencies.yaml
#    - alias: <alias>
#      url: <repo-url>
#      pinned_commit: <current HEAD>

# 3. Create source folder
mkdir -p claudekit/<alias>/

# 4. Vendor components — use dotclaude-component-picker skill
```

---

## 5. Build and publish a plugin

```bash
# Build bundle into plugins/<name>/
pnpm build-plugin <preset-name> --clean

# Verify output
ls plugins/<preset-name>/

# Commit the bundle on develop, then promote to master (see § 6)
pnpm publish-plugin <preset-name> --clean
```

Plugin bundles contain component files + `.claude-plugin/plugin.json`. Sidecar files (`*.source.yaml`, `SOURCE.yaml`) are excluded.

If the build fails, use the `preset-debugger` skill: *"the cistreaming plugin fails to build — debug it"*.

---

## 6. Promote develop → master

`master` holds only `plugins/`, `docs/`, and a few root files. Source dirs (`claudekit/`, `presets/`, `scripts/`) are stripped.

```bash
git checkout release/master   # or create a topic branch from hilab/master

# Cherry-pick the feature commit(s)
git cherry-pick <commit-hash>

# Apply the strip commit (removes claudekit/ presets/ scripts/ tsconfig.json etc.)
# Strip commit message: "chore(master): strip dev-only dirs"

# Push — both remotes if public content, hilab only if private
git push hilab release/master
git push origin release/master   # only for public (non-Hilab-specific) content
```

---

## Branch Strategy

| Branch | Contains | Purpose |
|--------|----------|---------|
| `develop` / `hilab-develop` | Full source tree + submodules (~270 MB) | All development work; all PRs/MRs target here |
| `master` / `hilab-master` | `plugins/` + `docs/` + root files | Lean release consumed by Claude Code marketplace |

`claudekit/` exists **only on develop** — it is the source for building `plugins/`. Once built, `claudekit/` is stripped from master.
