# dotclaude

Personal Claude Code configuration kit — owner-controlled core (`claudekit/`),
preset manifests (`presets/`), TypeScript installer, and plugin packaging.

> Owner: phantien133 (phanqtien@gmail.com).

## Objectives

- **`claudekit/`** — complete core kit (agents, skills, commands, hooks, rules) owned
  by the owner. Vendored from upstream (ECC, anthropic-skills, ...) with per-component
  provenance via sidecar YAML.
- **`presets/`** — pure manifest YAML pointing to component IDs in claudekit/. Contains
  no component code.
- **`upstream/`** — git submodules (ECC + 3 docs sources) serving as sync source +
  reference. Not a runtime dependency.
- **`scripts/`** — TypeScript installer (run via `tsx`) that reads a preset → installs
  into user/project target, with lifecycle and plugin packaging.

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
├── claudekit/<type>/              # Core kit (CQ-1a) — type-first, copy with sidecar
│   └── private/                   # GITIGNORED overlays
├── presets/<kind>/                # Pure manifest (CQ-3c)
│   ├── core/                      # cross-stack baseline
│   ├── framework/                 # framework-specific
│   ├── purpose/                   # task-specific
│   ├── private/                   # GITIGNORED
│   └── schema/                    # JSON Schema generated from zod
├── plugins/                       # Build artifacts for marketplace
├── marketplace.json               # Local marketplace index
├── upstream/<repo>/               # Submodules (sync source + docs)
├── scripts/                       # TS installer + lifecycle + plugin packaging
└── docs/                          # Architecture, CQ decisions, guides
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
