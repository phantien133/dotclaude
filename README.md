# dotclaude

Personal Claude Code configuration kit — owner-controlled core (`claudekit/`),
preset manifests (`presets/`), and TypeScript installer.

> Owner: phantien133 (phanqtien@gmail.com).
> Currently in Phase 1 of redesign — see `docs/redesign-plan.md` for status.

## Objectives

- **`claudekit/`** — complete core kit (agents, skills, commands, hooks, rules) owned
  by the owner. Vendored from upstream (ECC, anthropic-skills, ...) with per-component
  provenance via sidecar YAML.
- **`presets/`** — pure manifest YAML pointing to component IDs in claudekit/. Contains
  no component code.
- **`upstream/`** — git submodules (ECC + 3 docs sources) serving as sync source +
  reference. Not a runtime dependency.
- **`scripts/`** — TypeScript installer (run via `tsx`) that reads a preset → installs
  into user/project target.

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
```

### Available subcommands (Phase 1)

```bash
pnpm run list                              # List presets (public + private)
pnpm validate personal-baseline --kind core # Schema + reference + sidecar check
pnpm sync agents/code-reviewer             # Diff sidecar.commit ↔ upstream HEAD
pnpm schema:generate                       # Regen JSON Schema from zod
```

> `pnpm list` (without `run`) calls the pnpm built-in → use `pnpm run list` for preset listing.

### Upcoming subcommands (Phase 2+)

```bash
pnpm install:user <preset>                 # → ~/.claude/ (default symlink)
pnpm install:project <preset>              # → <cwd>/.claude/ (default copy)
pnpm init-private                          # Copy private.example/ → private/
pnpm uninstall <preset>                    # Phase 3
pnpm upgrade <preset>                      # Phase 3
```

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
├── plugins/                       # Phase 4 (preset → plugin bundle)
├── upstream/<repo>/               # Submodules (sync source + docs)
├── scripts/                       # TS installer
└── docs/                          # Architecture, plan, CQ, guides
```

See `docs/architecture.md` for design decisions; `docs/redesign-plan.md` for the 5-phase
implementation plan.

## Documentation

| Doc | Contents |
|---|---|
| `docs/architecture.md` | Design decisions post-redesign |
| `docs/redesign-plan.md` | 5-phase plan overview (in progress) |
| `docs/planning/` | Per-phase planning files (Phase 2–4) |
| `docs/clarifying-questions.md` | 12 CQs with decisions log |
| `docs/PROVENANCE.md` | Sidecar schema + sync workflow |
| `docs/PRESETS.md` | Preset schema + authoring guide |
| `docs/PRIVATE.md` | private/ convention + multi-machine bootstrap |
| `docs/INSTALL.md` | Installer usage |

## License

MIT (for dotclaude scripts + schema + docs). Vendored components retain the original
upstream license — see `<component>.source.yaml` or `<skill>/SOURCE.yaml`.
