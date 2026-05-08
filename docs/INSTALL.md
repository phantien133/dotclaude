# INSTALL — Installer Usage

> Phase 1 supports `validate` + `list`. `user` / `project` install will be implemented
> in Phase 2.

## Prerequisites

- Node ≥ 20 (tested with 23.7).
- pnpm ≥ 9 (tested with 10.28). Install via `corepack enable` or `brew install pnpm`.

## First-time setup

```bash
git clone --recursive git@github.com:phantien133/dotclaude.git
cd dotclaude
pnpm install
pnpm typecheck         # verify clean TypeScript
pnpm test              # 15+ tests pass
pnpm schema:generate   # regenerate JSON Schemas (idempotent)
```

## Available subcommands

### `pnpm run list`

List all presets (public + private) with kind, version, and tags.

```bash
pnpm run list                       # all presets
pnpm run list --kind core           # kind=core only
```

> **Note**: use `pnpm run list` (not `pnpm list`) because `list` is a pnpm
> built-in command (lists installed packages).

### `pnpm validate <preset-name> [--kind <k>]`

Validate a preset:
1. Schema validation via zod.
2. Verify name/kind match filename + folder.
3. Verify `extends:` parent presets resolve.
4. Verify each component ID in `components` exists in `claudekit/` (public or private).
5. Verify each component sidecar can be parsed.

```bash
pnpm validate personal-baseline --kind core
```

Exit codes:
- `0` — VALID.
- `1` — VALID WITH WARNINGS (e.g. missing `.md` companion).
- `2` — INVALID (schema error, missing component, missing parent in extends).

### `pnpm sync <type>/<id>`

Sync a component with upstream:
1. Locate component + sidecar in `claudekit/`.
2. Resolve `source.repo` via `dependencies.yaml` → upstream submodule.
3. Fetch `origin/<ref>`.
4. Diff `sidecar.source.commit` ↔ upstream HEAD at `source.path`.
5. Print diff for owner review.

```bash
pnpm sync agents/code-reviewer
pnpm sync skills/coding-standards
```

Phase 1 is DIFF only — owner merges manually, then updates sidecar `source.commit` +
`modified` flag as needed.

### `pnpm schema:generate`

Regenerate JSON Schemas from zod (re-run after editing `scripts/lib/schema.ts`):

```bash
pnpm schema:generate
# wrote presets/schema/preset.schema.json
# wrote presets/schema/sidecar.schema.json
# wrote presets/schema/manifest.schema.json
```

Idempotent — output is deterministic from the zod schema. Commit the JSON Schemas to
git (IDEs pick them up via the `# yaml-language-server: $schema=...` header).

## Upcoming subcommands (Phase 2)

```bash
pnpm install:user <preset>            # Install into ~/.claude/ (default: symlink)
pnpm install:project <preset>         # Install into <cwd>/.claude/ (default: copy)
pnpm init-private                     # Copy private.example/ → private/
pnpm clean-backups                    # Remove old *.bak.<timestamp> files
```

Phase 2 will add flags:
- `--copy` / `--symlink` — override default mode.
- `--force` / `--skip-existing` / `--prompt` — conflict policy (default: backup-then-overwrite).
- `--include-optional` — include optional dependencies from sidecar.
- `--dry-run` — show install plan without applying.

## Upcoming subcommands (Phase 3)

```bash
pnpm uninstall <preset>               # Revert components + settings_patch (reads manifest)
pnpm upgrade <preset>                 # Re-resolve preset, smart diff vs manifest
pnpm audit                            # List files in target not tracked by any manifest
```

## Config files

- `~/.claude/.dotclaude-manifest.yaml` — manifest for user-level installs.
- `<repo>/.claude/.dotclaude-manifest.yaml` — manifest for project-level installs.

Schema: `scripts/lib/schema.ts → ManifestSchema`.

## Troubleshooting

- **`pnpm list` shows npm packages instead of presets** — use `pnpm run list` (built-in conflict).
- **Validate fails "preset.name does not match filename"** — update `name:` in YAML to match the filename, or rename the file.
- **Validate fails "extends parent X not found"** — verify the parent preset exists at `presets/<any-kind>/<X>.yaml`.
- **Sync warns "git fetch returned non-zero"** — the submodule may be offline or the remote is unreachable. Diff still runs against local refs (may be stale).

## File reference

- `scripts/install.ts` — entry point (commander).
- `scripts/sync-from-upstream.ts` — sync logic.
- `scripts/generate-schemas.ts` — JSON Schema generator.
