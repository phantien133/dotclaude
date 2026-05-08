# INSTALL — Installer Usage

> Phase 1 hỗ trợ `validate` + `list`. `user` / `project` install sẽ implement
> Phase 2.

## Prerequisites

- Node ≥ 20 (tested với 23.7).
- pnpm ≥ 9 (tested với 10.28). Cài qua `corepack enable` hoặc `brew install pnpm`.

## First-time setup

```bash
git clone --recursive git@github.com:phantien133/dotclaude.git
cd dotclaude
pnpm install
pnpm typecheck         # verify TS sạch
pnpm test              # 15+ tests pass
pnpm schema:generate   # regenerate JSON Schemas (idempotent)
```

## Subcommands hiện có

### `pnpm run list`

List tất cả preset (public + private) với kind, version, tags.

```bash
pnpm run list                       # tất cả
pnpm run list --kind core           # chỉ kind=core
```

> **Note**: phải dùng `pnpm run list` (không phải `pnpm list`) vì `list` là pnpm
> built-in command (list installed packages).

### `pnpm validate <preset-name> [--kind <k>]`

Validate 1 preset:
1. Schema validation qua zod.
2. Verify name/kind match filename + folder.
3. Verify `extends:` parent presets resolve.
4. Verify mỗi component ID trong `components` tồn tại trong claudekit/ (public hoặc
   private).
5. Verify mỗi component sidecar parse được.

```bash
pnpm validate personal-baseline --kind core
```

Exit codes:
- `0` — VALID.
- `1` — VALID WITH WARNINGS (vd missing `.md` companion).
- `2` — INVALID (schema error, missing component, missing parent extends).

### `pnpm sync <type>/<id>`

Sync 1 component với upstream:
1. Locate component + sidecar trong claudekit/.
2. Resolve `source.repo` qua `dependencies.yaml` → upstream submodule.
3. Fetch `origin/<ref>`.
4. Diff `sidecar.source.commit` ↔ upstream HEAD theo `source.path`.
5. Print diff cho owner review.

```bash
pnpm sync agents/code-reviewer
pnpm sync skills/coding-standards
```

Phase 1 chỉ DIFF — owner merge thủ công, sau đó update sidecar `source.commit` +
`modified` flag nếu cần.

### `pnpm schema:generate`

Regenerate JSON Schemas từ zod (chạy lại khi sửa `scripts/lib/schema.ts`):

```bash
pnpm schema:generate
# wrote presets/schema/preset.schema.json
# wrote presets/schema/sidecar.schema.json
# wrote presets/schema/manifest.schema.json
```

Idempotent — output deterministic theo zod schema. Commit JSON Schema vào git
(IDE sẽ pick up qua header `# yaml-language-server: $schema=...`).

## Subcommands sắp có (Phase 2)

```bash
pnpm install:user <preset>            # Cài vào ~/.claude/ (default symlink)
pnpm install:project <preset>         # Cài vào <cwd>/.claude/ (default copy)
pnpm init-private                     # Copy private.example/ → private/
pnpm clean-backups                    # Xoá *.bak.<timestamp> cũ
```

Phase 2 sẽ thêm flags:
- `--copy` / `--symlink` — override default mode.
- `--force` / `--skip-existing` / `--prompt` — conflict policy (default
  backup-then-overwrite).
- `--include-optional` — include optional dependencies từ sidecar.
- `--dry-run` — show install plan, không apply.

## Subcommands sắp có (Phase 3)

```bash
pnpm uninstall <preset>               # Revert components + settings_patch (đọc manifest)
pnpm upgrade <preset>                 # Re-resolve preset, smart diff vs manifest
pnpm audit                            # List file ở target không thuộc manifest
```

## Config files

- `~/.claude/.dotclaude-manifest.yaml` — manifest cho user-level install.
- `<repo>/.claude/.dotclaude-manifest.yaml` — manifest cho project-level install.

Schema: `scripts/lib/schema.ts → ManifestSchema`.

## Troubleshooting

- **`pnpm list` show npm packages thay vì presets** — dùng `pnpm run list` (built-in
  conflict).
- **Validate fail "preset.name does not match filename"** — đổi `name:` trong YAML
  sync với filename, hoặc rename file.
- **Validate fail "extends parent X not found"** — verify parent preset tồn tại
  trong `presets/<any-kind>/<X>.yaml`.
- **Sync warns "git fetch returned non-zero"** — submodule có thể đang offline hoặc
  remote unreachable. Diff vẫn chạy với local refs (có thể stale).

## File reference

- `scripts/install.ts` — entry point (commander).
- `scripts/sync-from-upstream.ts` — sync logic.
- `scripts/generate-schemas.ts` — JSON Schema generator.
