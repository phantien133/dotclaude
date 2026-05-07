# Architecture & Design Decisions

## Tổng quan

`dotclaude` là một repo độc lập chứa cấu hình Claude Code cá nhân, đóng vai trò:

1. **Source of truth** — mọi customization (rules, agents, commands, hooks, skills tự viết) sống ở đây.
2. **Manifest** — khai báo external dependencies (ECC, marketplace plugins) qua `dependencies.yaml`, không vendor lậu.
3. **Installer** — script tự động cài đặt theo từng layer (user vs project) và từng preset stack.

## Two-layer model

| Layer | Đích cài | Dùng cho | Package gốc |
|---|---|---|---|
| User | `~/.claude/` | Cấu hình cá nhân, áp dụng mọi project | `packages/user/` |
| Project | `<repo>/.claude/` | Stack-specific (TS, Python, Go…) | `packages/presets/<stack>/` |

Claude Code tự merge cả 2 layer khi chạy. User layer chứa baseline bền (rules, agents, commands chung); project layer chỉ thêm skills cụ thể với stack đó.

## Vendor strategy

`vendor/` chứa external dependencies dưới dạng **git submodule** — đã setup:

| Submodule | Role | Lý do |
|---|---|---|
| `vendor/everything-claude-code` | runtime | Installer resolve modules từ đây |
| `vendor/anthropic-cookbook` | docs | Reference API patterns + Claude Code recipes khi build skill mới |
| `vendor/anthropic-skills` | docs | Skill format reference chính thức từ Anthropic |
| `vendor/mcp-servers` | docs | MCP server collection để học pattern khi cần extend agent |

### Lý do dùng submodule

- Tôn trọng nguồn (không copy-paste, giữ git history)
- Version-pinning rõ ràng qua submodule SHA
- Update có kiểm soát: `git submodule update --remote --merge`
- Khi clone `dotclaude` mới: `git clone --recursive` lấy luôn vendor

### Update workflow

```bash
# Update tất cả submodule lên HEAD của ref tracking (mặc định `main`)
git submodule update --remote --merge

# Hoặc update riêng một cái
git submodule update --remote vendor/anthropic-cookbook

# Refresh pinned_commit trong dependencies.yaml
for sub in vendor/*/; do
  echo "$sub: $(git -C "$sub" rev-parse HEAD)"
done

# Commit cả .gitmodules + dependencies.yaml
```

### Quy ước role

- `role: runtime` → installer **bắt buộc** present, parse + sử dụng.
- `role: docs` → reference cho con người + Claude khi research, **optional** khi clone (có thể skip submodule init nếu chỉ chạy installer).

Để clone gọn (chỉ runtime):
```bash
git clone git@github.com:phantien133/dotclaude.git
cd dotclaude
git submodule update --init vendor/everything-claude-code
```

## Dependency declaration model

`dependencies.yaml` (root) khai báo nguồn:

```yaml
sources:
  ecc:
    repo: https://github.com/...
    local_path: vendor/everything-claude-code
    pinned_commit: <hash>
    ref: main
```

Mỗi `packages/*/deps.yaml` chỉ reference source ID:

```yaml
ecc_modules:        # cho user package
  - rules-core
  - workflow-quality

ecc_skills:         # cho preset package
  - frontend-patterns
  - backend-patterns
```

Không hardcode URL hoặc commit ở package level. Một chỗ duy nhất để update version → toàn bộ packages thừa hưởng.

## Preset inheritance (tương lai)

Khi có nhiều preset tương tự (ví dụ `nestjs-prisma` kế thừa `typescript-fullstack`):

```yaml
# packages/presets/nestjs-prisma/deps.yaml
extends: typescript-fullstack
ecc_skills:
  - nestjs-patterns
  - jpa-patterns  # thêm so với base
```

Installer sẽ resolve `extends` recursively. Chưa implement ở phase 1.

## Non-goals

- **Không** publish lên npm/registry. Đây là repo cá nhân, clone + run script.
- **Không** quản lý Claude Code installation (binary). Chỉ quản lý configuration.
- **Không** thay thế ECC. ECC là dependency, dotclaude là layer trên.

## Open questions

- [ ] Có nên hỗ trợ team-shared preset namespace (`packages/presets/team-*`) không? — Nếu có, xét tách thành sub-package hoặc git remote khác.
- [ ] Cách persist user-level state (vd `settings.json` cá nhân) — overlay vs merge JSON?
- [ ] Lockfile (`dependencies.lock.yaml`) cho reproducible install — implement khi multi-source.
