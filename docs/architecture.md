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

## Vendor ECC strategy

`everything-claude-code` là dependency lớn nhất. Plan:

### Phase 1 (hiện tại — skeleton)
- ECC tham chiếu local path `../everything-claude-code` (relative từ `dotclaude/`).
- Hợp lý khi cả hai cùng nằm trong workspace `claude-code-guides/` để dev/test.

### Phase 2 (khi `dotclaude` move ra standalone)
- Vendor ECC vào `vendor/everything-claude-code/` dưới dạng **git submodule**:
  ```bash
  cd dotclaude
  git submodule add https://github.com/everything-claude-code/everything-claude-code vendor/everything-claude-code
  git submodule update --init --recursive
  ```
- Cập nhật `dependencies.yaml`:
  ```yaml
  sources:
    ecc:
      local_path: vendor/everything-claude-code
      pinned_commit: <hash>  # commit của submodule
  ```
- Lý do dùng submodule:
  - Tôn trọng nguồn (không copy-paste, giữ git history)
  - Version-pinning rõ ràng qua submodule SHA
  - Update có kiểm soát: `git submodule update --remote --merge`
  - Khi clone `dotclaude` mới: `git clone --recursive` lấy luôn ECC

### Phase 3 (tùy chọn)
- Mirror docs ECC quan trọng vào `docs/ecc-reference/` (snapshot read-only) để tham chiếu offline khi không clone submodule.
- Hoặc viết `scripts/sync-docs.sh` chỉ pull `everything-claude-code/the-shortform-guide.md`, `everything-claude-code/the-longform-guide.md`, `manifests/*.json` vào `docs/ecc-reference/`.

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
