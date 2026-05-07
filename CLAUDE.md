# CLAUDE.md — dotclaude

Repo cá nhân quản lý cấu hình Claude Code. Khi mở Claude Code ở folder này, các thông tin dưới đây là context chính.

## Owner & Communication

- Owner: phantien133 (phanqtien@gmail.com) — senior full-stack engineer
- Giao tiếp: **tiếng Việt** cho mọi response. **Tiếng Anh** cho code, file names, identifiers, commit messages.
- Trả lời ngắn gọn, thực hành được ngay — không cần giải thích cơ bản.

## Mục đích repo

Một nguồn duy nhất, có thể tái sử dụng, cho mọi cấu hình Claude Code cá nhân:

- **User-level** (`packages/user/`) → cài vào `~/.claude/` — baseline cá nhân, áp dụng mọi project.
- **Project presets** (`packages/presets/<stack>/`) → cài vào `<repo>/.claude/` — stack-specific.

Tôn trọng nguồn gốc: external plugins (ECC, marketplace) khai báo trong `dependencies.yaml`, không vendor lậu.

## Decisions đã chốt

| Quyết định | Chi tiết | Lý do |
|---|---|---|
| Tên repo | `dotclaude` | Theo dotfiles convention; map trực quan với `.claude/` |
| Two-layer model | user (`~/.claude/`) + preset (`<repo>/.claude/`) | Tách config bền (user) và config theo stack (preset) |
| ECC integration | External dependency, không fork/copy | Giữ kết nối nguồn, version-pinning rõ ràng |
| Bỏ `framework-language` ở user level | Module này kéo skills của ~15 ngôn ngữ | Skills nên ở preset, đúng stack mới load |
| User-level modules | `rules-core`, `agents-core`, `commands-core`, `hooks-runtime`, `platform-configs`, `workflow-quality`, `database` | Baseline cross-stack, không bias ngôn ngữ |
| Symlink mặc định cho preset | `--copy` chỉ khi cần self-contained | Update ECC tự động lan, đỡ phình repo |
| Folder location hiện tại | Workspace tạm cho skeleton phase | Sẽ move ra standalone (`~/dotclaude/`) sau khi ổn định |

## Architecture

Xem `docs/architecture.md` cho chi tiết. Tóm tắt:

```
dotclaude/
├── dependencies.yaml          # Nguồn external (ECC, plugins) + commit pinning
├── packages/
│   ├── user/                  # → ~/.claude/
│   │   ├── deps.yaml          # ECC modules
│   │   ├── rules/, agents/, commands/, hooks/, skills/   # Personal overlays
│   └── presets/               # → <repo>/.claude/
│       ├── typescript-fullstack/
│       ├── python-django/
│       └── go-backend/
├── scripts/install.sh         # Entry: ./scripts/install.sh user|preset|list
├── vendor/                    # (Phase 2) ECC submodule
└── docs/                      # ADR, design notes
```

## Vendor ECC plan (3 phases)

1. **Hiện tại**: `local_path: ../everything-claude-code` (relative) — vì cả hai cùng trong workspace `claude-code-guides/`.
2. **Khi move standalone**: `git submodule add` ECC vào `vendor/everything-claude-code/`. Update `dependencies.yaml` `local_path: vendor/everything-claude-code`.
3. **Optional**: mirror ECC docs (shortform/longform guides, manifests) vào `docs/ecc-reference/` để offline reference.

## Workflow phổ biến

### Cài user-level baseline

```bash
./scripts/install.sh user --dry-run    # xem plan
./scripts/install.sh user              # apply thật
./scripts/install.sh user --skip-ecc   # chỉ overlay personal files, không gọi ECC installer
```

### Cài preset cho repo cụ thể

```bash
cd /path/to/your-project
~/path/to/dotclaude/scripts/install.sh preset typescript-fullstack
~/path/to/dotclaude/scripts/install.sh preset python-django --copy   # copy thay vì symlink
```

### Thêm preset mới

1. `mkdir packages/presets/<stack>` → tạo `deps.yaml`, `README.md`, `CLAUDE.md.template`, `skills/`.
2. `deps.yaml`: liệt kê `ecc_skills` cần thiết cho stack đó.
3. Test: `./scripts/install.sh preset <stack> --dry-run` ở repo thử nghiệm.
4. Commit.

### Thêm agent/skill cá nhân

- **Cross-stack** → `packages/user/agents/` hoặc `packages/user/skills/`.
- **Stack-specific** → `packages/presets/<stack>/skills/`.
- Format theo ECC convention: markdown + YAML frontmatter (`name`, `description`, `tools`, `model`).
- Reference: `everything-claude-code/CONTRIBUTING.md`, `everything-claude-code/docs/SKILL-DEVELOPMENT-GUIDE.md`.

### Update ECC version

1. `cd vendor/everything-claude-code && git pull origin main` (sau Phase 2) hoặc cập nhật path local.
2. Cập nhật `pinned_commit` trong `dependencies.yaml` root: `git -C vendor/everything-claude-code rev-parse HEAD`.
3. Re-run `./scripts/install.sh user` để verify modules còn hợp lệ.
4. Commit `dependencies.yaml` + `.gitmodules`.

### Test installer

```bash
# Smoke test parse
./scripts/install.sh list
./scripts/install.sh user --dry-run --skip-ecc
./scripts/install.sh preset typescript-fullstack --dry-run
```

## Nguyên tắc khi sửa code trong repo này

1. **Không hardcode** ECC URL/commit ở package level — chỉ trong `dependencies.yaml` root.
2. **Awk parser** trong scripts cố ý tránh dependency `yq`/`python` để self-contained. Khi schema deps.yaml phức tạp hơn, cân nhắc switch sang Python script (chấp nhận thêm dependency).
3. **Symlink an toàn**: scripts xóa `dst` trước (`rm -rf '$dst'`) — chỉ chạy với CWD `.claude/skills/` của repo, không bao giờ chạy ngoài.
4. **Dry-run trước**: mọi thay đổi installer test bằng `--dry-run` trước.
5. **Commit small**: mỗi preset/feature một commit độc lập, conventional commit (`feat:`, `fix:`, `docs:`, `refactor:`).

## Plugin ecosystem references

> Caveat: kiến thức của tôi đến ~01/2026, star counts thay đổi liên tục — verify trước khi adopt. Đặt vào `dependencies.yaml` với commit pinning nếu thực sự dùng.

### Collections để tham khảo / port

| Repo | Mô tả | Khi nào hữu ích |
|---|---|---|
| [`everything-claude-code/everything-claude-code`](https://github.com/everything-claude-code/everything-claude-code) | ECC — đã vendor | Source of truth cho user-level baseline |
| [`anthropics/anthropic-cookbook`](https://github.com/anthropics/anthropic-cookbook) | Official Anthropic examples (API + Claude Code patterns) | Khi build skill mới hoặc MCP server, reference patterns chuẩn |
| [`anthropics/skills`](https://github.com/anthropics/skills) | Official Anthropic skills collection (nếu có repo này) | Skills mẫu chất lượng cao, theo chuẩn Anthropic |
| [`hesreallyhim/awesome-claude-code`](https://github.com/hesreallyhim/awesome-claude-code) | Awesome list — agents, skills, hooks, MCP, articles | Discover tools mới |
| [`wshobson/agents`](https://github.com/wshobson/agents) | Bộ sưu tập agent đa dạng (~100+ specialized agents) | Port agent có sẵn vào `packages/user/agents/` |
| [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers) | Official MCP server collection | Khi cần extend agent với tool mới qua MCP |

### Tools / frameworks build agent

| Tool | Mô tả | Use case |
|---|---|---|
| [`promptfoo/promptfoo`](https://github.com/promptfoo/promptfoo) | Eval framework cho LLM prompts/agents | Test agent quality khi viết mới hoặc thay đổi |
| [`ryoppippi/ccusage`](https://github.com/ryoppippi/ccusage) | Track Claude Code usage/cost | Bật khi dev nhiều, monitor token cost |
| [`jlowin/fastmcp`](https://github.com/jlowin/fastmcp) | Build MCP server bằng Python (FastAPI-style) | Khi cần custom MCP cho domain riêng |
| [`modelcontextprotocol/typescript-sdk`](https://github.com/modelcontextprotocol/typescript-sdk) | MCP TS SDK chính thức | Build MCP server bằng TypeScript |
| [`anthropics/claude-code`](https://github.com/anthropics/claude-code) | CLI repo chính thức | Theo dõi release notes, hook API thay đổi |

### Pattern để adopt

- **Skill format** → ECC `skills/*/SKILL.md` cấu trúc: When to Use, How It Works, Examples.
- **Agent format** → ECC `agents/*.md` với YAML frontmatter (`name`, `description`, `tools`, `model`).
- **Hook format** → ECC `hooks/` JSON config, hook scripts trong `scripts/hooks/`.

Khi tìm thấy repo phù hợp, evaluation checklist trước khi adopt:
1. License compatible (MIT/Apache prefer).
2. Maintenance active (commits trong 6 tháng gần nhất).
3. Test/CI present.
4. Conform với format ECC hoặc dễ port.
5. Star count + community signal (issues responsive, không phải abandoned).

## Open questions / TODO

- [ ] Move repo ra standalone (`~/dotclaude/`) sau khi skeleton ổn định.
- [ ] Vendor ECC submodule (Phase 2).
- [ ] `scripts/update.sh` — automate ECC pull + commit pin refresh.
- [ ] Lockfile `dependencies.lock.yaml` cho reproducible install.
- [ ] Preset `extends:` inheritance (vd `nestjs-prisma extends typescript-fullstack`).
- [ ] CI: validate `deps.yaml` references tồn tại trong ECC; lint markdown.
- [ ] Settings.json strategy — overlay vs merge JSON ở user level.
- [ ] Khi nào setup remote (GitHub) + private/public.

## References trong repo

- `README.md` — quickstart công khai
- `docs/architecture.md` — design decisions sâu
- `dependencies.yaml` — nguồn external
- `packages/*/deps.yaml` — module/skill list cho từng package
- `packages/*/README.md` — chi tiết từng package

## Session lineage

Skeleton này build từ session ngày 2026-05-07. Highlights để Claude session tiếp theo nhanh nắm bối cảnh:

- ECC manifests đã đọc: `everything-claude-code/manifests/{install-modules,install-profiles,install-components}.json`.
- ECC `installer.sh` mặc định target `claude` = `~/.claude/`. Không có target "claude-project" sẵn → preset dùng symlink/copy thủ công thay vì gọi ECC installer.
- Profile ECC `developer` đã loại sẵn business-content/social-distribution/media-generation/swift-apple/supply-chain-domain — đó là baseline gần với mong muốn user, nhưng vẫn kéo `framework-language` (đa ngôn ngữ) → quyết định dùng `--modules` thay profile để fine-grain.
- Workspace cha (`claude-code-guides/`) cố ý KHÔNG init git — chỉ là workspace chứa nhiều repo độc lập.
