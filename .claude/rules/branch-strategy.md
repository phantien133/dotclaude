# Branch Strategy

Two long-lived branches with distinct purposes. Never commit directly to master.

## develop / hilab-develop — full development environment

All PRs and MRs target this branch. Contains the complete source tree:

| Directory | Contents |
|-----------|----------|
| `claudekit/` | Component source — skills, rules, agents, hooks, organized by upstream source |
| `presets/` | Preset manifests (`preset.yaml` + docs) |
| `scripts/` | Build, installer, sync, and schema tooling |
| `upstream/` | Vendored submodules (~270 MB: everything-claude-code, anthropic-skills, etc.) |
| `plugins/` | Built plugin bundles — committed here after `pnpm build-plugin` |

`claudekit/` exists **only on develop**. It is the source from which `plugins/` is built.

## master / hilab-master — lean release branch

Consumed by Claude Code marketplace via `/plugin marketplace add`. Contains only distributable content:

| Path | Purpose |
|------|---------|
| `plugins/<name>/` | Pre-built plugin bundles ready for installation |
| `.claude-plugin/marketplace.json` | Marketplace index read by Claude Code |

`claudekit/`, `presets/`, `scripts/`, and `upstream/` are **not present** on master — stripped to keep the clone small (a few MB vs ~270 MB on develop).

## Promoting develop → master

```bash
git checkout hilab-master   # or master for GitHub

# Cherry-pick feature commits (not the strip commit itself)
git cherry-pick <commit-hash>

# Re-apply the strip commit to remove dev-only dirs
# Result: only plugins/ and .claude-plugin/ remain as content

git push hilab hilab-master           # always
git push origin master                # only if public (non-hilab-specific) content
```

The strip commit message is `chore(master): strip dev-only dirs` and removes `claudekit/`, `presets/`, `scripts/`, `upstream/` from the tree.

## Summary

```
develop  = full source + submodules  →  where all work happens
master   = plugins/ only             →  what users install
```
