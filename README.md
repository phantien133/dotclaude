# dotclaude — Claude Code plugin marketplace

Curated Claude Code plugins built from `dotclaude` presets.
Add the marketplace once, then install only the plugins you need per machine or
project.

> For details on what `dotclaude` is, how it's organized, and how to author your
> own preset / build new plugin bundles, see [ABOUT.md](./ABOUT.md).

---

## Available plugins

All bundles live under `plugins/` and are registered in
[`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json).
Full preset docs and authoring guide: **[docs/PLUGINS.md](./docs/PLUGINS.md)**

### Cross-stack baselines

| Plugin | Version | Description | Preset docs |
|---|---|---|---|
| [`core`](./plugins/core/) | 0.1.0 | Universal baseline for any Claude Code user — context management, productivity, and semantic search. | [README](./presets/core/core/README.md) |
| [`ai-native`](./plugins/ai-native/) | 0.1.0 | Extends `core` with AI self-learning and skill creation. For users who want Claude to improve with their personal workflow over time. | [README](./presets/core/ai-native/README.md) |
| [`developer`](./plugins/developer/) | 0.1.0 | Extends `ai-native` with cross-stack developer tooling — GitHub ops, quality gates, architecture planning. | [README](./presets/core/developer/README.md) |

### Framework presets

| Plugin | Version | Description | Preset docs |
|---|---|---|---|
| [`typescript`](./plugins/typescript/) | 0.1.0 | TypeScript language preset — coding style, idiomatic patterns, testing, security rules, and a dedicated TS code reviewer. Base for any TS framework. | [README](./presets/framework/typescript/README.md) |
| [`nestjs`](./plugins/nestjs/) | 0.1.0 | NestJS modular TypeScript backend — DTO validation, guards, database integration, API design patterns. Extends `developer` + `typescript`. | [README](./presets/framework/nestjs/README.md) |
| [`nextjs`](./plugins/nextjs/) | 0.1.0 | Next.js React app structure — Turbopack dev server, frontend patterns for production apps. Extends `developer` + `typescript`. | [README](./presets/framework/nextjs/README.md) |

### Dotclaude self-tooling

| Plugin | Version | Description | Preset docs |
|---|---|---|---|
| [`dotclaude-bootstrap`](./plugins/dotclaude-bootstrap/) | 0.1.0 | First-time setup wizard, preset-creation wizard, debugger, and external plugin discovery. Install at user level when onboarding new dotclaude users. | [README](./presets/purpose/dotclaude-bootstrap/README.md) |
| [`dotclaude-self`](./plugins/dotclaude-self/) | 0.2.0 | Full dotclaude working environment — preset authoring wizards, self-learning, component picker, skill creator. Install only when working inside a cloned `dotclaude` repo. | [README](./presets/purpose/dotclaude-self/README.md) |
| [`presales-workflow`](./plugins/presales-workflow/) | 0.1.0 | Pre-sales developer workflow — ingest client documents (PDF/xlsx/Word), research online, break down tasks, and produce estimation templates and proposals. | [README](./presets/purpose/presales-workflow/README.md) |

---

## Install via Claude Code marketplace

### 1. Make sure you have GitHub SSH access

```bash
ssh -T git@github.com
# Expected: "Hi <username>! You've successfully authenticated..."
```

If you haven't set up GitHub SSH, follow the [GitHub SSH setup guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh).

### 2. Add the marketplace to Claude Code

Inside any Claude Code session:

```
/plugin marketplace add git@github.com:phantien133/dotclaude.git
```

Claude Code will clone the repo into its local marketplace cache and read
`.claude-plugin/marketplace.json` — the marketplace is registered under the
name `dotclaude`. To refresh later:

```
/plugin marketplace update dotclaude
```

### 3. Install a plugin

```
/plugin install <plugin-name>@dotclaude
```

For example:

```
/plugin install developer@dotclaude          # at user level
/plugin install nestjs@dotclaude             # for NestJS backend projects
/plugin install core@dotclaude
```

Browse what's available without installing:

```
/plugin marketplace list dotclaude
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
3. **TypeScript projects**: add `typescript` as the language foundation.
4. **Backend / frontend**: add `nestjs` and/or `nextjs` as needed.
5. **Working inside this repo**: add `dotclaude-self` for the preset-authoring
   tooling.

---

## Branch workflow — `develop` vs `master`

This repo uses two long-lived branches with fundamentally different contents:

| Branch | What it contains | Purpose |
|---|---|---|
| `develop` | Full source tree: `claudekit/`, `presets/`, `scripts/`, `upstream/` submodules (~270 MB), `plugins/` | Active development — all PRs target here |
| `master` | `plugins/<name>/` + `.claude-plugin/marketplace.json` **only** | Lean release consumed by Claude Code marketplace |

**Key difference:** `claudekit/` exists only on `develop`. It is the source from which `plugins/` is built. Once built, `claudekit/` is not needed by end-users and is stripped from `master` — keeping the marketplace clone small (a few MB vs ~270 MB).

**Rules:**

1. **Never PR directly to `master`.** Open all PRs against `develop`.
2. **Publishing to the marketplace** = promote `develop` → `master` by cherry-picking feature commits then re-applying the strip commit (`chore(master): strip dev-only dirs`) that removes `claudekit/`, `presets/`, `scripts/`, and `upstream/`.
3. **Local dev** = checkout `develop` + `git submodule update --init --recursive`. Cloning `master` skips all source and submodule content.
→ **[DEVELOPMENT.md](./DEVELOPMENT.md)** — full guide: vendoring components, creating presets, adding upstream sources, building plugins, and promoting to master.

---

## License

MIT (for `dotclaude` scripts, schema, and docs). Vendored components retain
their original upstream licenses — see each `<component>.source.yaml` or
`<skill>/SOURCE.yaml` inside `claudekit/`.
