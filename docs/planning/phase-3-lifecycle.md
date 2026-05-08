# Phase 3 — Lifecycle

> **Status**: PENDING (sau Phase 2)
>
> **Prereq**: Phase 2 install pipeline hoàn thành + manifest tracking stable.

## Goal

Lifecycle đầy đủ: uninstall, upgrade, audit. Round-trip install → modify → uninstall không
để lại leftover.

## Scope

| Deliverable | Command |
|---|---|
| Uninstall preset | `pnpm uninstall <preset>` |
| Upgrade preset | `pnpm upgrade <preset>` |
| Audit target | `pnpm audit [--target <path>]` |

## Steps (draft — sẽ refine trước Phase 3)

### S1 — Uninstall

- Đọc manifest (`~/.claude/.dotclaude-manifest.yaml` hoặc `<cwd>/.claude/...`).
- Lọc components thuộc preset được uninstall. Cẩn thận: component được share bởi nhiều
  preset (manifest track `required_by`) → chỉ xóa nếu không còn preset nào khác require.
- Revert: xóa symlink/file. Nếu có `.bak.*` tương ứng → restore bak (hỏi user).
- Revert `settings_patch`: deep-remove keys do preset này thêm (phức tạp, cần strategy
  riêng).
- Update manifest.

### S2 — Upgrade

- Re-resolve preset (kéo extends + deps mới nhất).
- Diff với manifest cũ → 3 loại operations: ADD (component mới), REMOVE (không còn trong
  preset), UPDATE (component đã đổi nội dung).
- Apply diff từng operation.
- Update manifest.

### S3 — Audit

- Scan tất cả file trong `~/.claude/` (hoặc target `.claude/`).
- So với manifest → list file không thuộc bất kỳ installed preset nào.
- Output: `[UNTRACKED] ~/.claude/agents/foo.md` — owner quyết.
- Không tự xóa, chỉ report.

## Open questions Phase 3 (resolve trước khi implement)

- **settings_patch revert**: không thể đơn giản deep-delete vì user có thể đã tay-edit.
  Strategy: snapshot settings trước install → diff → revert chỉ phần diff?
- **Upgrade conflict**: file đã local-edit → merge conflict hay backup + overwrite?
- **Partial uninstall**: user muốn giữ 1 component nhưng uninstall preset → có flag
  `--keep <id>` không?
