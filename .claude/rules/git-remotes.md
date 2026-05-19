# Git Remotes & Branch Strategy

This repo has two remotes with distinct visibility and purpose.

## Remotes

| Remote | URL | Visibility |
|--------|-----|------------|
| `hilab` | `ssh://git@gitlab.hilab.cloud:2424/hilabaikit/dotclaude.git` | Private — Hilab company GitLab |
| `origin` | `git@github.com:phantien133/dotclaude.git` | Public — personal GitHub |

## Branches

### develop / hilab-develop — active development

| Branch | Remote |
|--------|--------|
| `hilab-develop` | `hilab` (GitLab) |
| `develop` | `origin` (GitHub) |

- All PRs and MRs target this branch — never open directly against master.
- Includes git submodules under `upstream/` (~270 MB): `everything-claude-code`, `anthropic-skills`, etc.
- Full dev environment: sync scripts, schema generation, build tooling all work here.
- `hilab-develop` and `develop` carry the same public content; `hilab-develop` additionally carries private/hilab-specific commits that are never pushed to `origin`.

### master / hilab-master — lean release

| Branch | Remote |
|--------|--------|
| `hilab-master` | `hilab` (GitLab) |
| `master` | `origin` (GitHub) |

- No submodules — kept small for fast cloning by end users.
- Consumed by Claude Code marketplace: `/plugin marketplace add ssh://...` clones this branch.
- Never commit directly to master. Promote from develop by cherry-picking feature commits on top of the strip commit that removes dev-only content.
- What belongs on master: `plugins/<name>/` (built bundles) + `.claude-plugin/marketplace.json`. Everything else is dev-only.
- `claudekit/` exists **only on develop** — it is the source used to build `plugins/`. Once built and committed, `claudekit/` is stripped from master alongside `upstream/`, `presets/`, and `scripts/`.

## Routing Rules

**Private → `hilab` only (never `origin`):**
- Content referencing Hilab, Hilab projects, or internal infrastructure
- Cistreaming preset and any platform-specific presets
- Anything under `claudekit/private/` or `presets/private/`
- Credentials, internal URLs, team-specific config

**Public → both `hilab` and `origin`:**
- Core framework (dotclaude infrastructure, installer, schema)
- Generic presets: `core`, `ai-native`, `developer`, `nestjs`, `nextjs`
- `dotclaude-bootstrap`, `dotclaude-self` plugins
- Root `README.md`, `ABOUT.md`, `docs/` (non-private)

## Workflow

```bash
# Feature work (private content):
git push hilab <local-branch>:hilab-develop   # MR on GitLab only

# Feature work (public content):
git push hilab <local-branch>:hilab-develop   # MR on GitLab
git push origin <local-branch>:develop        # PR on GitHub

# Release (promote develop → master):
# Cherry-pick feature commits over master's strip commit on each remote
git push hilab hilab-master
git push origin master
```

Never push private/hilab-specific content to `origin`.
