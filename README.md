# dotclaude

Personal Claude Code configuration kit — owner-controlled core (`claudekit/`),
preset manifests (`presets/`), and TypeScript installer.

> Owner: phantien133 (phanqtien@gmail.com).
> Currently in Phase 1 of redesign — see `docs/redesign-plan.md` for status.

## Mục tiêu

- **`claudekit/`** — bộ core đầy đủ (agents, skills, commands, hooks, rules) do
  owner sở hữu. Vendor từ upstream (ECC, anthropic-skills, ...) với provenance per
  component qua sidecar YAML.
- **`presets/`** — pure manifest YAML trỏ vào component IDs trong claudekit/. Không
  chứa code component.
- **`upstream/`** — git submodules (ECC + 3 docs sources) đóng vai trò sync source +
  reference. Không phải runtime.
- **`scripts/`** — TypeScript installer (chạy qua `tsx`) đọc preset → install vào
  user/project target.

## Quickstart

### Prerequisites

- Node ≥ 20
- pnpm ≥ 9 (`corepack enable` hoặc `brew install pnpm`)

### Setup

```bash
git clone --recursive git@github.com:phantien133/dotclaude.git
cd dotclaude
pnpm install
pnpm typecheck
pnpm test
```

### Subcommands hiện có (Phase 1)

```bash
pnpm run list                              # List presets (public + private)
pnpm validate personal-baseline --kind core # Schema + reference + sidecar check
pnpm sync agents/code-reviewer             # Diff sidecar.commit ↔ upstream HEAD
pnpm schema:generate                       # Regen JSON Schema từ zod
```

> `pnpm list` (không có `run`) gọi pnpm builtin → dùng `pnpm run list` cho preset list.

### Subcommands sắp có (Phase 2+)

```bash
pnpm install:user <preset>                 # → ~/.claude/ (default symlink)
pnpm install:project <preset>              # → <cwd>/.claude/ (default copy)
pnpm init-private                          # Copy private.example/ → private/
pnpm uninstall <preset>                    # Phase 3
pnpm upgrade <preset>                      # Phase 3
```

Xem `docs/INSTALL.md` cho usage chi tiết.

## Cấu trúc

```
dotclaude/
├── claudekit/<type>/              # Core kit (CQ-1a) — type-first, copy với sidecar
│   └── private/                   # GITIGNORED overlays
├── presets/<kind>/                # Pure manifest (CQ-3c)
│   ├── core/                      # cross-stack baseline
│   ├── framework/                 # framework-specific
│   ├── purpose/                   # task-specific
│   ├── private/                   # GITIGNORED
│   └── schema/                    # JSON Schema generated từ zod
├── plugins/                       # Phase 4 (preset → plugin bundle)
├── upstream/<repo>/               # Submodules (sync source + docs)
├── scripts/                       # TS installer
└── docs/                          # Architecture, plan, CQ, guides
```

Xem `docs/architecture.md` cho design decisions; `docs/redesign-plan.md` cho 5-phase
implementation plan.

## Documentation

| Doc | Nội dung |
|---|---|
| `docs/architecture.md` | Design decisions sau redesign |
| `docs/redesign-plan.md` | 5-phase plan (in progress) |
| `docs/clarifying-questions.md` | 12 CQ với decisions log |
| `docs/PROVENANCE.md` | Sidecar schema + sync workflow |
| `docs/PRESETS.md` | Preset schema + authoring guide |
| `docs/PRIVATE.md` | private/ convention + bootstrap multi-machine |
| `docs/INSTALL.md` | Installer usage |

## License

MIT (cho dotclaude scripts + schema + docs). Vendored components giữ license gốc của
upstream — xem `<component>.source.yaml` hoặc `<skill>/SOURCE.yaml`.
