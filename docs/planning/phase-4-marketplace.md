# Phase 4 — Marketplace + Plugin

> **Status**: PENDING (sau Phase 3)
>
> **Prereq**: Phase 3 lifecycle stable + Claude Code plugin API docs verified.

## Goal

1-2 preset đầu publish được lên marketplace tự-host. User khác (hoặc owner ở máy mới) cài
qua plugin install flow chính thức của Claude Code.

## Scope

| Deliverable | Detail |
|---|---|
| Plugin build script | `scripts/build-plugin.ts` |
| Plugin manifest format | `plugins/<preset>/plugin.json` |
| Self-hosted marketplace repo | `phantien133/claudekit-marketplace` (repo riêng) |
| Publish workflow | Build → push artifact sang marketplace repo |

## Steps (draft — sẽ refine trước Phase 4)

### S1 — Verify Claude plugin model

Đọc docs Anthropic mới nhất về:
- Plugin manifest format (`plugin.json` fields, version, entry points).
- Marketplace index format (single `marketplace.json` hay folder per plugin?).
- Install flow: `/plugin marketplace add <url>` → `/plugin install <name>`.

Source: `upstream/anthropic-cookbook` + Claude Code official docs.

**Block**: nếu plugin API chưa public/stable → điều chỉnh scope Phase 4.

### S2 — `scripts/build-plugin.ts`

- Input: preset name.
- Resolver chạy giống install (kéo extends, deps, tất cả components).
- Output: `plugins/<preset>/`
  - `plugin.json` — auto-generate từ preset metadata (name, version, description, tags,
    component list).
  - Components đóng gói bên trong (không symlink — plugin phải self-contained).
  - Exclude `SOURCE.yaml` khỏi bundle.

### S3 — Marketplace repo

- Tạo repo `phantien133/claudekit-marketplace` (public).
- Layout:
  ```
  marketplace.json         # index: list tất cả plugins + version + url
  plugins/
    personal-baseline/
      plugin.json
      agents/...
      skills/...
  ```
- Workflow: `pnpm run publish <preset>` → build + copy sang marketplace repo + commit +
  push.

### S4 — Test round-trip

Từ máy khác (hoặc fresh profile):
```bash
# Giả sử Claude Code hỗ trợ:
/plugin marketplace add https://github.com/phantien133/claudekit-marketplace
/plugin install personal-baseline
```
Verify file có ở `~/.claude/` đúng.

## Open questions Phase 4

- **Plugin format thực tế**: Anthropic có public spec chưa? Nếu chưa → scope Phase 4 thu
  hẹp thành "build bundle zip + manual install" thay vì marketplace.
- **Versioning**: khi preset update (bump version), marketplace update thế nào? CI auto-push
  hay manual?
- **License**: component từ ECC có MIT → bundle được. Nhưng cần ghi license info trong
  plugin.json.
