# dotclaude

Personal Claude Code configuration kit — owner-controlled core (`claudekit/`),
preset manifests (`presets/`), TypeScript installer, and plugin packaging.

## Motivation

Managing Claude Code tools and plugins for daily work is harder than it looks: too many
options, no clear way to pick what's right for a specific project, and no way to evaluate
whether a plugin is actually helping or just adding noise.

This repo solves that problem — personal, curated, measurable:

- **Right-sized**: pick only what's needed per project, nothing more
- **Traceable**: every vendored component has a sidecar YAML recording its origin, license,
  and modifications
- **Evaluable**: skills are benchmarked with and without — so quality is measurable, not
  assumed

## Roadmap

**P1 — Bootstrap** *(done)*: vibe-code the skeleton (installer, preset schema, sidecar
format), vendor the plugins already in active use, get to a working daily-driver state fast.

**P2 — Helpers** *(in progress)*: complete the tooling so updates, preset authoring, and building
personal plugins are fast and simple — the `dotclaude-component-picker` skill, eval loop,
sync workflow, and plugin packaging.

**P3 — Operate & refine** *(ongoing)*: fix bugs that surface during real use, self-improve
tools after using them, track upstream open-source changes. License compliance becomes a
first-class concern at this phase.

## Getting Started

There are two ways to use dotclaude. **Option A is recommended** — it gives you the full
toolchain, preset authoring, and the ability to customize everything. Option B is a lighter
path for quick onboarding without a local clone.

---

### Option A — Clone & use locally *(recommended)*

Full control: all scripts, skills, and preset authoring tools available inside Claude Code.

#### Prerequisites

- Node ≥ 20
- pnpm ≥ 9 (`corepack enable` or `brew install pnpm`)

#### Setup

```bash
git clone --recursive ssh://git@gitlab.hilab.cloud:2424/hilabaikit/dotclaude.git
cd dotclaude
pnpm install
pnpm typecheck
pnpm test
# pnpm init-private   # then restore private content from cloud sync
```

Open the cloned folder in Claude Code. The `dotclaude-self` preset (installed at project
level) activates the full working environment: `/preset-wizard`, `/dotclaude-setup`,
`dotclaude-component-picker`, `skill-creator`, and the self-learning hooks.

```bash
# Install a preset to your global Claude config
pnpm install:user developer

# Or to the current project
pnpm install:project developer
```

#### Subcommands

```bash
pnpm run list                                  # List presets (public + private)
pnpm validate developer --kind core            # Schema + reference + sidecar check
pnpm sync agents/code-reviewer                 # Diff sidecar.commit ↔ upstream HEAD
pnpm schema:generate                           # Regen JSON Schema from zod

pnpm install:user <preset>                     # → ~/.claude/ (default symlink)
pnpm install:project <preset>                  # → <cwd>/.claude/ (default copy)
pnpm uninstall:user <preset>                   # Remove installed preset
pnpm upgrade:user <preset>                     # Re-install updated preset
pnpm audit:user                                # Check installed vs current kit

pnpm build-plugin <preset>                     # Preset → plugin bundle
pnpm publish-plugin <preset>                   # Build + update marketplace.json
```

> `pnpm list` (without `run`) calls the pnpm built-in → use `pnpm run list` for preset listing.

See `docs/INSTALL.md` for detailed usage.

---

### Option B — Install `dotclaude-bootstrap` plugin *(not recommended)*

No clone needed. Installs the bootstrap wizard and preset-creation tools at user level via
the [claudekit-marketplace](https://gitlab.hilab.cloud/hilabaikit/claudekit-marketplace) plugin.

> **Limitations**: no local scripts, no preset authoring, no sync workflow, no private
> overlays. Use this only for a quick taste or when you can't clone the repo.

```bash
# Add the marketplace to your Claude Code user settings, then install the plugin:
# Settings → Marketplace → claudekit-marketplace → dotclaude-bootstrap → Install (user level)
```

Once installed, run `/dotclaude-setup` inside Claude Code — the setup wizard will guide you
through finding and installing a preset that fits your workflow.

> `dotclaude-bootstrap` is published to the marketplace at
> [hilabaikit/claudekit-marketplace](https://gitlab.hilab.cloud/hilabaikit/claudekit-marketplace).

## Structure

```
dotclaude/
├── claudekit/<type>/              # Core kit — type-first, copy with sidecar
│   └── private/                   # GITIGNORED overlays
├── presets/<kind>/                # Pure manifest
│   ├── core/                      # cross-stack baseline
│   ├── framework/                 # framework-specific
│   ├── purpose/                   # task-specific
│   ├── private/                   # GITIGNORED
│   └── schema/                    # JSON Schema generated from zod
├── plugins/                       # Build artifacts for marketplace
├── marketplace.json               # Local marketplace index
├── upstream/<repo>/               # Submodules (sync source + docs)
├── scripts/                       # TS installer + lifecycle + plugin packaging
└── docs/                          # Architecture + guides
```

See `docs/architecture.md` for design decisions and full layout.

## Documentation

| Doc | Contents |
|---|---|
| `docs/architecture.md` | Design decisions + layout |
| `docs/PROVENANCE.md` | Sidecar schema + sync workflow |
| `docs/PRESETS.md` | Preset schema + authoring guide |
| `docs/PRIVATE.md` | private/ convention + multi-machine bootstrap |
| `docs/INSTALL.md` | Installer usage |

## License

MIT (for dotclaude scripts + schema + docs). Vendored components retain the original
upstream license — see `<component>.source.yaml` or `<skill>/SOURCE.yaml`.
