# dotclaude

Personal Claude Code configuration kit — owner-controlled core (`claudekit/`),
preset manifests (`presets/`), TypeScript installer, and plugin packaging.

> Owner: phantien133 (phanqtien@gmail.com).

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

**P2 — Helpers** *(done)*: complete the tooling so updates, preset authoring, and building
personal plugins are fast and simple — the `dotclaude-component-picker` skill, eval loop,
sync workflow, and plugin packaging.

**P3 — Operate & refine** *(ongoing)*: fix bugs that surface during real use, self-improve
tools after using them, track upstream open-source changes. License compliance becomes a
first-class concern at this phase.

## Quickstart

### Prerequisites

- Node ≥ 20
- pnpm ≥ 9 (`corepack enable` or `brew install pnpm`)

### Setup

```bash
git clone --recursive git@github.com:phantien133/dotclaude.git
cd dotclaude
pnpm install
pnpm typecheck
pnpm test
# pnpm init-private   # then restore private content from cloud sync
```

### Subcommands

```bash
pnpm run list                                  # List presets (public + private)
pnpm validate personal-baseline --kind core    # Schema + reference + sidecar check
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
