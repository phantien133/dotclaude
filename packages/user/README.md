# packages/user

Baseline cấu hình cài vào `~/.claude/`, áp dụng cho mọi project.

## Đích cài

`~/.claude/`

## Bao gồm

1. **ECC baseline modules** — khai báo trong `deps.yaml`. Cài qua `everything-claude-code/install.sh`.
2. **Personal overlays** — file riêng trong các thư mục:
   - `rules/` — rules cá nhân (vd: `tienpq-style.md`), bổ sung hoặc override ECC
   - `agents/` — agents tự viết
   - `commands/` — slash commands cá nhân
   - `hooks/` — hooks tự viết
   - `skills/` — skills cross-project (vd: `personal-conventions`)

## Triết lý "cái gì ở user, cái gì ở preset"

- **User**: bền, không đổi theo stack — coding philosophy, security baseline, agent orchestration, workflow quality.
- **Preset**: language/framework cụ thể — `python-patterns`, `frontend-patterns`, `django-tdd`…

→ User layer mỏng và bền. Preset layer dày nhưng chỉ load khi vào repo tương ứng.

## Cài

```bash
# Từ root dotclaude:
./scripts/install.sh user --dry-run
./scripts/install.sh user
```

## Update

1. Chỉnh `pinned_commit` trong `dependencies.yaml` (root).
2. Hoặc thêm/bớt module trong `deps.yaml` (file này thư mục).
3. Chạy lại `./scripts/install.sh user`.
