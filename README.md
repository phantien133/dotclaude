# dotclaude — Hilab Claude Code plugin marketplace

Curated Claude Code plugins for the Hilab team, built from `dotclaude` presets.
Add the marketplace once, then install only the plugins you need per machine or
project.

> For details on what `dotclaude` is, how it's organized, and how to author your
> own preset / build new plugin bundles, see [ABOUT.md](./ABOUT.md).

---

## Available plugins

All bundles live under `plugins/` and are registered in
[`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json).

### Cross-stack baselines

| Plugin | Version | Description |
|---|---|---|
| [`core`](./plugins/core/) | 0.1.0 | Universal baseline for any Claude Code user — context management, productivity, and semantic search. |
| [`ai-native`](./plugins/ai-native/) | 0.1.0 | Extends `core` with AI self-learning and skill creation. For users who want Claude to improve with their personal workflow over time. |
| [`developer`](./plugins/developer/) | 0.1.0 | Extends `ai-native` with cross-stack developer tooling — GitHub ops, quality gates, architecture planning. |

### Framework presets

| Plugin | Version | Description |
|---|---|---|
| [`typescript`](./plugins/typescript/) | 0.1.0 | TypeScript language preset — coding style, idiomatic patterns, testing, security rules, and a dedicated TS code reviewer. Base for any TS framework. |
| [`nestjs`](./plugins/nestjs/) | 0.1.0 | NestJS modular TypeScript backend — DTO validation, guards, database integration, API design patterns. Extends `developer` + `typescript`. |
| [`nextjs`](./plugins/nextjs/) | 0.1.0 | Next.js React app structure — Turbopack dev server, frontend patterns for production apps. Extends `developer` + `typescript`. |

### Hilab streaming workflow

| Plugin | Version | Description |
|---|---|---|
| [`cistreaming`](./plugins/cistreaming/) | 1.0.0 | Dev workflow for the cistreaming platform (NestJS + Next.js + SRS + GraphQL). Public `w-*` suite + `f-*` Figma flow + streaming rules + doc governance. Replaces deprecated `cistreaming-v2/v3/v4`. |

### Dotclaude self-tooling

| Plugin | Version | Description |
|---|---|---|
| [`dotclaude-bootstrap`](./plugins/dotclaude-bootstrap/) | 0.1.0 | First-time setup wizard, preset-creation wizard, debugger, and external plugin discovery. Install at user level when onboarding new dotclaude users. |
| [`dotclaude-self`](./plugins/dotclaude-self/) | 0.2.0 | Full dotclaude working environment — preset authoring wizards, self-learning, component picker, skill creator. Install only when working inside a cloned `dotclaude` repo. |

---

## Install via Claude Code marketplace

### 1. Make sure you can reach Hilab GitLab

The marketplace lives at `gitlab.hilab.cloud/hilabaikit/dotclaude`. SSH access is
required (port `2424`):

```bash
# Add an SSH key in GitLab → User settings → SSH Keys, then verify:
ssh -T git@gitlab.hilab.cloud -p 2424
# Expected: "Welcome to GitLab, @<your-username>!"
```

If you've never cloned a Hilab repo before, the [GitLab SSH setup
docs](https://gitlab.hilab.cloud/-/user_settings/ssh_keys) walk through key
creation.

### 2. Add the marketplace to Claude Code

Inside any Claude Code session:

```
/plugin marketplace add ssh://git@gitlab.hilab.cloud:2424/hilabaikit/dotclaude.git
```

Claude Code will clone the repo into its local marketplace cache and read
`.claude-plugin/marketplace.json` — the marketplace is registered under the
name `hilab-dotclaude`. To refresh later:

```
/plugin marketplace update hilab-dotclaude
```

### 3. Install a plugin

```
/plugin install <plugin-name>@hilab-dotclaude
```

For example:

```
/plugin install developer@hilab-dotclaude          # at user level
/plugin install cistreaming@hilab-dotclaude     # for the streaming team
/plugin install core@hilab-dotclaude
```

Browse what's available without installing:

```
/plugin marketplace list hilab-dotclaude
```

### 4. Update or remove

```
/plugin update <plugin-name>      # pull latest bundle from the marketplace
/plugin uninstall <plugin-name>   # remove from this Claude install
```

---

## Recommended install order

Start small and stack:

1. **Everyone**: `core` — context management + productivity baseline.
2. **Most engineers**: add `ai-native` (self-learning) and `developer` (GitHub /
   quality gates).
3. **Backend / frontend**: add `nestjs` and/or `nextjs` as needed.
4. **Streaming team**: install `cistreaming` (it extends `nestjs` + `nextjs`
   so you get those transitively — don't double install).
5. **Working inside this repo**: add `dotclaude-self` for the preset-authoring
   tooling.

---

## Branch workflow — `develop` vs `master`

This repo uses two long-lived branches:

| Branch | Contains `upstream/` submodules? | Purpose |
|---|---|---|
| [`develop`](https://gitlab.hilab.cloud/hilabaikit/dotclaude/-/tree/develop) | **Yes** (~270 MB) | Active development branch — vendoring from upstream, sync scripts, full dev environment. All PRs / MRs target this branch. |
| [`master`](https://gitlab.hilab.cloud/hilabaikit/dotclaude/-/tree/master) | **No** | Lean release branch consumed by Claude Code marketplace. `/plugin marketplace add` clones this branch, so it must stay small for fast installs. |

**Rules:**

1. **Never PR directly to `master`.** Open all MRs against `develop`.
2. **Publishing to the marketplace** = promote `develop` → `master` (cherry-pick
   feature commits over master's strip commit, or merge develop and re-apply the
   `chore(master): strip upstream/` commit on top).
3. **Local dev** = checkout `develop` + `git submodule update --init --recursive`.
   Cloning `master` skips the 270 MB of submodule content entirely.

---

## License

MIT (for `dotclaude` scripts, schema, and docs). Vendored components retain
their original upstream licenses — see each `<component>.source.yaml` or
`<skill>/SOURCE.yaml` inside `claudekit/`.
