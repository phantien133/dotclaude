# dotclaude

Personal Claude Code configuration packages — reusable across user level (`~/.claude/`) and project level (`.claude/`).

Owner: phantien133 (phanqtien@gmail.com)

## Mục tiêu

- Một nguồn duy nhất cho mọi cấu hình Claude Code cá nhân (rules, agents, commands, hooks, skills).
- Tách rõ **user-level** (cài vào `~/.claude/`) và **project-level** (cài vào `.claude/` của repo cụ thể).
- Tôn trọng nguồn gốc: mọi external plugin (ECC, marketplace skills…) khai báo trong `dependencies.yaml` với commit/tag pinning, không copy-paste mất nguồn.
- Dễ install, dễ update, dễ kế thừa giữa các dự án tương đương.

## Cấu trúc

```
dotclaude/
├── README.md                  # File này
├── dependencies.yaml          # Nguồn external (ECC, plugins) + pinned commits
├── packages/
│   ├── user/                  # Baseline cho ~/.claude/
│   │   ├── deps.yaml          # ECC modules cần cài cho user level
│   │   ├── rules/             # Rules cá nhân (override hoặc bổ sung ECC)
│   │   ├── agents/            # Agents tự viết
│   │   ├── commands/          # Slash commands cá nhân
│   │   ├── hooks/             # Hooks tự viết
│   │   └── skills/            # Skills tự viết, dùng cross-project
│   └── presets/               # Project-level templates
│       ├── typescript-fullstack/
│       │   ├── deps.yaml      # ECC skills + custom skills
│       │   ├── CLAUDE.md.template
│       │   └── skills/        # Skills riêng cho preset này
│       ├── python-django/
│       └── go-backend/
├── scripts/
│   ├── install.sh             # Entry point — gọi install-user hoặc install-preset
│   ├── install-user.sh        # Cài package user vào ~/.claude/
│   └── install-preset.sh      # Cài preset vào .claude/ của repo hiện tại
├── vendor/                    # (Plan) ECC sẽ ở đây dạng submodule, xem docs/architecture.md
└── docs/                      # Notes, ADR, design decisions
```

## Quickstart

### Cài đặt user-level baseline

```bash
./scripts/install.sh user --dry-run
./scripts/install.sh user
```

Script sẽ:
1. Resolve ECC modules trong `packages/user/deps.yaml`
2. Gọi `everything-claude-code/install.sh --modules <ids>` để cài ECC modules vào `~/.claude/`
3. Overlay file riêng từ `packages/user/{rules,agents,commands,hooks,skills}/` vào `~/.claude/`

### Cài đặt preset cho repo hiện tại

```bash
cd /path/to/your-project
~/path/to/dotclaude/scripts/install.sh preset typescript-fullstack
```

Sẽ tạo `.claude/` ở project root với skills/CLAUDE.md từ preset.

## Tôn trọng nguồn gốc

`dependencies.yaml` ở root khai báo:
- Mọi external plugin source (ECC URL, commit pinned)
- Path local nếu đang dev
- Version constraint

Mỗi `packages/*/deps.yaml` chỉ tham chiếu các source ID đã khai báo ở root — không hardcode URL/path lặp lại.

Khi update ECC: chỉnh `pinned_commit` trong `dependencies.yaml`, chạy `scripts/update.sh` (TODO).

## Roadmap

- [ ] Vendor ECC vào `vendor/everything-claude-code/` dưới dạng submodule (xem `docs/architecture.md`)
- [ ] `scripts/update.sh` — pull latest ECC, refresh pinned commits
- [ ] CI check: validate deps.yaml references tồn tại
- [ ] Preset cho `monorepo-pnpm`, `nestjs-prisma`, `next-app-router`
- [ ] Test harness: dry-run install + diff với baseline
