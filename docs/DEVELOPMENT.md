# Development Guide

How to work inside this repo: vendor components, author presets, add upstream sources, and publish plugins.

For design decisions see [architecture.md](architecture.md). For sidecar schema see [PROVENANCE.md](PROVENANCE.md). For preset schema see [PRESETS.md](PRESETS.md).

> **Branch note:** all development work happens on `develop` / `hilab-develop`. The `master` / `hilab-master` branches contain only built plugin bundles — see [Branch Strategy](#branch-strategy) at the bottom.

---

## 1. Vendor a component from upstream

Use the `dotclaude-component-picker` skill for the guided 8-step pipeline (browse → evaluate → cross-reference → vendor → sidecar → preset → install → verify). Or follow the manual path:

```bash
# Prerequisites: develop branch + submodules initialized
git submodule update --init --recursive

# 1. Find the component
ls upstream/everything-claude-code/{agents,skills,commands,hooks,rules}/

# 2. Copy into the matching source folder
cp upstream/everything-claude-code/agents/<name>.md \
   claudekit/everything-claude-code/agents/<name>.md

# 3. Get the pin commit
git -C upstream/everything-claude-code rev-parse HEAD

# 4. Create sidecar (see docs/PROVENANCE.md for schema)
#    claudekit/everything-claude-code/agents/<name>.source.yaml

# 5. Reference in a preset
#    presets/<kind>/<name>/preset.yaml
#    components.agents: [{name: <name>, source: everything-claude-code}]

# 6. Verify
pnpm typecheck && pnpm test
```

---

## 2. Create or edit a preset

```bash
KIND=core   # or: framework, purpose
NAME=my-preset

mkdir -p presets/$KIND/$NAME
cp presets/core/developer/preset.yaml presets/$KIND/$NAME/preset.yaml
cp presets/core/developer/README.md   presets/$KIND/$NAME/README.md
$EDITOR presets/$KIND/$NAME/preset.yaml

pnpm validate $NAME --kind $KIND
```

Every component reference in `preset.yaml` is an object `{name, source}` — bare strings do not parse. Valid `source` aliases are listed in [CLAUDE.md § Source layout](../CLAUDE.md).

See [PRESETS.md](PRESETS.md) for the full schema and authoring guide.

---

## 3. Add a new upstream source

```bash
# 1. Add submodule
git submodule add <repo-url> upstream/<alias>

# 2. Record in dependencies.yaml
#    - alias: <alias>
#      url: <repo-url>
#      pinned_commit: <current HEAD>

# 3. Create source folder
mkdir -p claudekit/<alias>/

# 4. Vendor components (follow § 1 above)
```

---

## 4. Build and publish a plugin

```bash
# Build bundle into plugins/<name>/
pnpm build-plugin <preset-name> --clean

# Verify output
ls plugins/<preset-name>/

# Commit the bundle on develop, then promote to master (see § 5)
pnpm publish-plugin <preset-name> --clean
```

Plugin bundles contain component files + `.claude-plugin/plugin.json`. Sidecar files (`*.source.yaml`, `SOURCE.yaml`) are excluded from bundles.

---

## 5. Promote develop → master

`master` / `hilab-master` holds only `plugins/` and `.claude-plugin/marketplace.json`. Everything else (`claudekit/`, `presets/`, `scripts/`, `upstream/`) is absent.

```bash
git checkout hilab-master

# Cherry-pick the feature commit(s) — not the strip commit
git cherry-pick <commit-hash>

# Re-apply the strip commit to remove dev-only directories
# Strip commit message: "chore(master): strip dev-only dirs"

# Push
git push hilab hilab-master            # always
git push origin master                 # only for public (non-Hilab-specific) content
```

---

## Branch Strategy

| Branch | Contains | Purpose |
|--------|----------|---------|
| `develop` / `hilab-develop` | Full source tree + submodules (~270 MB) | All development work; all PRs/MRs target here |
| `master` / `hilab-master` | `plugins/` + marketplace index only | Lean release consumed by Claude Code marketplace |

`claudekit/` exists **only on develop** — it is the source for building `plugins/`. Once built, `claudekit/` is not needed by end-users and is stripped from master.
