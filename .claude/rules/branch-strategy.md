# Branch Strategy

Two long-lived branches with distinct purposes. Never commit directly to master.

## develop — full development environment

All PRs target this branch. Contains the complete source tree:

| Directory | Contents |
|-----------|----------|
| `claudekit/` | Component source — skills, rules, agents, hooks, organized by upstream source |
| `presets/` | Preset manifests (`preset.yaml` + docs) |
| `scripts/` | Build, installer, sync, and schema tooling |
| `upstream/` | Vendored submodules (~270 MB: everything-claude-code, anthropic-skills, etc.) |
| `plugins/` | Built plugin bundles — committed here after `pnpm build-plugin` |

`claudekit/` exists **only on develop**. It is the source from which `plugins/` is built.

## master — lean release branch

Consumed by Claude Code marketplace via `/plugin marketplace add`. Contains only distributable content:

| Path | Purpose |
|------|---------|
| `plugins/<name>/` | Pre-built plugin bundles ready for installation |
| `.claude-plugin/marketplace.json` | Marketplace index read by Claude Code |

Stripped paths (not present on master): `claudekit/`, `presets/`, `scripts/`, `upstream/`,
`CLAUDE.md`, `.claude/`, `.github/`, `.ci/` — defined in `.ci/master-strip.txt`.

## Promoting develop → master

**Fully automated via CI — no manual action needed.**

Push changes to `develop` and the CI handles everything:

```
develop push
    └── CI triggers automatically
            └── rsync develop → release/promote-to-master (strips dev-only dirs)
                    └── opens PR (or appends commit to existing open PR)
                            └── merge PR → master updated
```

- GitHub: `.github/workflows/promote-to-master.yml`
- GitLab (hilab): `.gitlab-ci.yml`

**Do not:**
- Push directly to `master` or `hilab/master`
- Manually create PRs/MRs targeting master
- Check out local `master` or `hilab-master` branches (both deleted)

The only action needed is committing and pushing to `develop`. The CI takes care of the rest.

## Summary

```
develop  = full source + submodules  →  where all work happens
master   = plugins/ only             →  what users install, managed by CI
```
