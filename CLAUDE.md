# CLAUDE.md — dotclaude

Repo cá nhân quản lý Claude Code config (claudekit core + preset manifests + TS
installer). Khi mở Claude Code ở folder này, các thông tin dưới đây là context chính.

## Owner & Communication

- Owner: phantien133 (phanqtien@gmail.com) — senior full-stack engineer.
- Giao tiếp: **tiếng Việt** cho mọi response. **Tiếng Anh** cho code, file names,
  identifiers, commit messages.
- Trả lời ngắn gọn, thực hành được ngay — không cần giải thích cơ bản.

## Trạng thái hiện tại (2026-05-08)

Phase 0, 0.5, 1 hoàn thành. Phase 2 chưa bắt đầu.

```
✓ Phase 0   — Wipe skeleton (packages/ + scripts/ bash, vendor/ → upstream/)
✓ Phase 0.5 — pnpm + TypeScript + tsx + zod + vitest bootstrap
✓ Phase 1   — claudekit/ + presets/ + 1 component vendored + validate/list/sync commands
☐ Phase 2   — Install pipeline (user symlink, project copy, manifest, deps resolver)
☐ Phase 3   — Lifecycle (uninstall, upgrade, audit)
☐ Phase 4   — Marketplace + plugin packaging (self-hosted)
```

Xem `docs/redesign-plan.md` Section 5 cho chi tiết per phase.

## Architecture (sau redesign)

```
dotclaude/
├── CLAUDE.md / README.md / dependencies.yaml
├── package.json + tsconfig.json + vitest.config.ts + pnpm-lock.yaml
│
├── claudekit/                      # Core kit, type-first (CQ-1a)
│   ├── agents/<n>.md + <n>.source.yaml
│   ├── skills/<n>/SKILL.md + SOURCE.yaml
│   ├── {commands,hooks,rules}/
│   ├── private/                    # GITIGNORED
│   └── private.example/            # TRACKED skeleton
│
├── presets/                        # Pure manifest (CQ-3c)
│   ├── {core,framework,purpose}/<name>.yaml + .md
│   ├── private/ + private.example/
│   └── schema/*.schema.json        # Generated từ zod
│
├── plugins/                        # Phase 4
├── upstream/                       # Submodules (CQ-7) — sync_source + docs
└── scripts/                        # 100% TS qua tsx (CQ-10 revised)
    ├── install.ts                  # Entry: validate | list | user | project
    ├── sync-from-upstream.ts
    ├── generate-schemas.ts
    └── lib/{schema,yaml,paths,sidecar,preset,upstream,logger}.ts
```

## Decisions chốt qua 12 CQ

Source-of-truth chi tiết: `docs/clarifying-questions.md` (Decisions log cuối file).

| CQ | Decision |
|---|---|
| 1a | Top-level core: `claudekit/` |
| 1b | Layout: type-first ECC style, naming prefix theo domain |
| 1c | Import mode: copy thuần, owner kiểm soát |
| 1d | Modify tracking: edit thẳng + sidecar `modified` flag + `modifications` text |
| 2 | Sidecar YAML: file `<n>.source.yaml`, folder `SOURCE.yaml` (excluded khi install) |
| 3a-d | Preset YAML + companion MD, folder theo kind, `extends:` ngay Phase 1 |
| 4a-d | `private/` per top package, mirror public, manual cloud-sync bootstrap |
| 5a-e | User+Project Phase 1, user=symlink default project=copy default, backup-then-overwrite, idempotent MUST, manifest YAML tracking |
| 6a-c | Marketplace self-hosted (`phantien133/claudekit-marketplace`), 1-1 preset↔plugin, defer Phase 4 |
| 7 | `vendor/` → `upstream/`, ECC role: sync_source |
| 9 | Migration: wipe & rewrite |
| 10 | 100% TS + pnpm + tsx (revised từ Bun) |
| 11 | YAML cho file owner control, JSON cho convention bên ngoài |
| 12 | Sidecar `dependencies.required/optional/external`, resolver auto-include verbose |

## Workflow phổ biến

### Setup máy mới

```bash
git clone --recursive git@github.com:phantien133/dotclaude.git
cd dotclaude
pnpm install
pnpm typecheck && pnpm test
# Phase 2 (sắp có): pnpm init-private + restore private content từ cloud sync
```

### Vendor 1 component mới từ upstream

```bash
# Copy file/folder
cp upstream/everything-claude-code/agents/<name>.md claudekit/agents/<name>.md

# Get pin
git -C upstream/everything-claude-code rev-parse HEAD

# Tạo sidecar (template từ component khác)
$EDITOR claudekit/agents/<name>.source.yaml

# Verify
pnpm typecheck && pnpm test
```

Xem `docs/PROVENANCE.md` cho schema sidecar + workflow chi tiết.

### Tạo preset mới

```bash
KIND=core; NAME=my-baseline
cp presets/core/personal-baseline.yaml presets/$KIND/$NAME.yaml
cp presets/core/personal-baseline.md   presets/$KIND/$NAME.md
$EDITOR presets/$KIND/$NAME.yaml
pnpm validate $NAME --kind $KIND
```

Xem `docs/PRESETS.md` cho schema + authoring guide.

### Sync upstream

```bash
git submodule update --remote upstream/everything-claude-code
git -C upstream/everything-claude-code rev-parse HEAD  # update dependencies.yaml pinned_commit
pnpm sync agents/code-reviewer                         # diff per-component
# Owner merge thủ công, update sidecar.source.commit nếu adopt
```

### Regenerate JSON Schema

```bash
pnpm schema:generate   # idempotent, commit kết quả vào git
```

Sau khi sửa `scripts/lib/schema.ts`, chạy lệnh này để JSON Schema không drift.

## Nguyên tắc khi sửa code

1. **Schema-first**: thay đổi shape data → sửa zod schema trước, regen JSON Schema,
   rồi cập nhật consumer. Test phải pass.
2. **Sidecar sync**: edit component trong `claudekit/` → set `modified: true` +
   update `modifications:` text. Đừng quên.
3. **Strict TS**: `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` ở
   tsconfig — code phải xử lý `undefined` rõ. Không cast bừa.
4. **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`. Body
   tiếng Việt OK, header English.
5. **Commit small**: 1 commit cho 1 việc — easier để revert.
6. **Verify destructive trước**: trước khi `git rm` / `rm -rf` / submodule deinit,
   confirm với owner (không tự ý).

## Common pitfalls

- **`pnpm list` vs `pnpm run list`**: built-in pnpm `list` chiếm ưu tiên. Dùng
  `pnpm run list` để gọi script preset list.
- **Date trong YAML**: js-yaml mặc định parse `2026-05-08` thành Date. Repo dùng
  `lib/yaml.ts` với `CORE_SCHEMA` để giữ string. Đừng `import yaml from 'js-yaml'`
  trực tiếp — dùng `import { loadYaml, dumpYaml } from './lib/yaml.ts'`.
- **Sidecar path**: file-component sidecar = `<name>.source.yaml` cùng dir;
  folder-component = `SOURCE.yaml` BÊN TRONG folder. Installer phải EXCLUDE
  `SOURCE.yaml` khi copy folder ra target.

## References trong repo

- `README.md` — quickstart công khai
- `docs/architecture.md` — design decisions sau redesign
- `docs/redesign-plan.md` — 5-phase plan (in progress)
- `docs/clarifying-questions.md` — 12 CQ + decisions log
- `docs/PROVENANCE.md` — sidecar schema + sync workflow
- `docs/PRESETS.md` — preset schema + authoring guide
- `docs/PRIVATE.md` — private/ convention + bootstrap
- `docs/INSTALL.md` — installer usage
- `dependencies.yaml` — upstream sources (4 submodules) + pinned commits

## Plugin ecosystem references

Khi cần port pattern hoặc mở rộng kit (verify trước khi adopt — license, maintenance,
test/CI):

| Repo | Mục đích |
|---|---|
| `everything-claude-code/everything-claude-code` | ECC — đã vendor (sync source) |
| `anthropics/anthropic-cookbook` | API + Claude Code patterns (docs) |
| `anthropics/skills` | Skill format reference (docs) |
| `modelcontextprotocol/servers` | MCP server collection (docs) |
| `hesreallyhim/awesome-claude-code` | Awesome list — discover tools |
| `wshobson/agents` | 100+ specialized agents để port |
| `promptfoo/promptfoo` | Eval framework cho prompts/agents |
| `jlowin/fastmcp` | MCP server (Python, FastAPI-style) |
| `modelcontextprotocol/typescript-sdk` | MCP TS SDK chính thức |

## Open questions / TODO

- [ ] Phase 2 — Install pipeline (next).
- [ ] Phase 3 — Lifecycle (uninstall, upgrade, audit).
- [ ] Phase 4 — Marketplace + plugin packaging.
- [ ] Lockfile strategy chi tiết (manifest đã 1 phần).
- [ ] CI: pnpm typecheck + test + schema regen drift check.
- [ ] Settings.json deep-merge với array policy (replace vs concat per field).
- [ ] Setup remote GitHub (private/public) + push sau Phase 2.

## Session lineage

- 2026-05-07: skeleton (`packages/` + bash scripts) build từ session đầu, chưa verify.
- 2026-05-08:
  - Redesign plan + 12 CQ chốt (Section 5 redesign-plan.md).
  - Phase 0 wipe skeleton (commit `d5045f7`).
  - Phase 0.5 TS+pnpm+tsx bootstrap (commit `5865a1d`).
  - Phase 1 in-progress: claudekit/agents/code-reviewer + skills/coding-standards
    vendored, presets/core/personal-baseline tạo, validate/list/sync subcommands
    chạy, 15 vitest tests pass.
