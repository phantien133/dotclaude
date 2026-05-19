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

## Required local branches

Always maintain exactly these 4 local branches:

| Local branch | Tracks | Purpose |
|---|---|---|
| `hilab-develop` | `hilab/develop` | Primary dev branch — all work starts here |
| `hilab-master` | `hilab/master` | Release branch for GitLab marketplace |
| `develop` | `origin/develop` | Public mirror of hilab-develop (no private content) |
| `master` | `origin/master` | Release branch for GitHub marketplace |

Bootstrap after a fresh clone:

```bash
git fetch --all
git checkout -B hilab-develop hilab/develop
git checkout -B hilab-master  hilab/master
git checkout -B develop       origin/develop
git checkout -B master        origin/master
git checkout hilab-develop
```

## PR / MR checklist

Every feature must land in **all 4 targets** before it is considered done:

| # | Target | Repo | Contains |
|---|--------|------|----------|
| 1 | `develop` on `hilab` | GitLab | Full source + private content |
| 2 | `master` on `hilab` | GitLab | Plugin bundles only (`plugins/`) |
| 3 | `develop` on `origin` | GitHub | Full source, **no private content** |
| 4 | `master` on `origin` | GitHub | Plugin bundles only, **no private content** |

Rules:
- All source changes (scripts, claudekit, presets, schema) → develop on both repos
- Final build artifacts (`plugins/*/`) → master on both repos
- `develop` must be merged **before** creating master PRs (master takes plugin output from develop build)
- Never open a PR/MR directly against master from a feature branch that has source-only changes — build first

## Privacy fence — origin must never contain

- Any file referencing Hilab, hilab.cloud, or hilab internal infrastructure
- `plugins/cistreaming/` or any `presets/private/` content
- `claudekit/private/` content
- Credentials, internal URLs, team-member names tied to Hilab

When publicizing a branch for `origin`, always run:
```bash
# Verify no private content before pushing to origin
git diff origin/develop...HEAD -- presets/private/ claudekit/private/ plugins/cistreaming/
# Output must be empty
```

## Workflow

```bash
# Feature work (private content):
git push hilab <local-branch>:hilab-develop   # MR on GitLab only

# Feature work (public content):
git push hilab <local-branch>:hilab-develop   # MR on GitLab
git push origin <local-branch>:develop        # PR on GitHub

# Release (promote develop → master):
# 1. Build plugins on develop: pnpm build-plugin <name> --clean
# 2. Commit built plugins to a release branch based on master
# 3. Open MR/PR against master on each repo
git push hilab <release-branch>:hilab-master   # MR → master on GitLab
git push origin <release-branch>:master        # PR → master on GitHub
```

Never push private/hilab-specific content to `origin`.
