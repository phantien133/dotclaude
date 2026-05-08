# Clarifying Questions — Redesign

> Câu hỏi cần owner trả lời trước khi generate plan thật trong [redesign-plan.md](./redesign-plan.md).
>
> Mỗi CQ ghi rõ: **Vấn đề** (cái gì cần chốt), **Vì sao** (tại sao quan trọng),
> **Options** (lựa chọn + trade-off), **Recommendation** (đề xuất nếu có), **Status**.
>
> Status: `pending` (chưa hỏi) / `asking` (đang hỏi) / `answered` (đã chốt) / `blocked` (chờ CQ khác).

Workflow: hỏi từng CQ một bằng AskUserQuestion. Khi answered → ghi câu trả lời + lý do
ngắn vào `Decision` của CQ đó. Khi đủ → generate plan ở `redesign-plan.md`.

---

## CQ-1 — Layout của core

Liên quan: REQ-1 (bộ claudekit core).

### CQ-1a — Tên + vị trí top-level của core

**Vấn đề**: Bộ kit core đặt ở đâu trong repo, gọi tên là gì?

**Vì sao**: Tên + vị trí ảnh hưởng đến mọi import path, script paths, docs, plugin
manifest. Đổi sau này tốn refactor.

**Options**:
- **A. `core/`** — ngắn, ở root.
- **B. `kit/`** — ngắn hơn, generic.
- **C. `claudekit/`** — explicit, brandable, match tên owner gọi.
- **D. `packages/core/`** — giữ pattern monorepo của skeleton hiện tại.

**Trade-off**: A/B/C flat ở root, dễ navigate, phù hợp khi presets/plugins cũng flat.
D phù hợp nếu repo sẽ có nhiều "package" độc lập sau này. Owner đã nói preset là pure
manifest → khó coi là "package" thực sự → flat ở root có vẻ hợp lý hơn.

**Recommendation**: A (`core/`) — ngắn, rõ ý, phù hợp pattern flat với `presets/` +
`plugins/` cùng level.

**Status**: answered (2026-05-07)

**Decision**: **C — `claudekit/`**. Top-level layout `claudekit/ + presets/ + plugins/
+ scripts/`. Owner chọn explicit/brandable hơn ngắn. Mọi path sau này dùng
`claudekit/<type>/<name>` làm canonical reference.

---

### CQ-1b — Cấu trúc bên trong core

**Vấn đề**: Cách group component bên trong core: phẳng theo loại, group theo domain,
hay hybrid?

**Vì sao**: Cấu trúc này quyết định cách presets reference tới component (ID phẳng vs
ID có namespace) và cách scale khi có nhiều domain (web/python/go/...).

**Options**:
- **A. Type-first** (giống ECC): `core/agents/`, `core/skills/`, `core/commands/`,
  `core/hooks/`, `core/rules/`. Component reference bằng ID phẳng (`code-reviewer`,
  `coding-standards`).
- **B. Domain-first**: `core/web/{agents,skills}/`, `core/python/{agents,skills}/`,
  `core/common/{agents,skills}/`. Reference cần namespace (`web/coding-standards`).
- **C. Hybrid**: top-level type, sub-folder domain bên trong (`core/skills/web/`,
  `core/skills/python/`, `core/agents/common/`).

**Trade-off**: A đơn giản nhưng dễ tên trùng giữa các domain. B mirror đẹp với rule sets
nhưng presets phải gọi qua namespace dài. C cân bằng — type là khái niệm chính của
Claude (theo convention `~/.claude/{agents,skills,commands,hooks}`), domain là chi tiết
phụ → install vẫn flatten ra `~/.claude/agents/<name>.md`.

**Recommendation**: C (Hybrid) vì khớp Claude convention khi install (top-level type)
và vẫn group được theo domain trong source repo. Nhưng nếu owner thấy ECC pattern A
quen thuộc và đủ thì A cũng được — đặc biệt khi naming kỷ luật bằng prefix
(`web-coding-standards`, `python-coding-standards`).

**Status**: answered (2026-05-07)

**Decision**: **A — Type-first (ECC style)**. Phẳng theo loại, naming prefix
(`web-`, `python-`, `go-`, ...) để tránh trùng. Convention sẽ được ghi rõ trong style
guide của repo. Lý do chọn A: khớp ECC quen thuộc, installer đơn giản (1 cấp), preset
reference IDs phẳng dễ đọc.

**Hệ quả**:
- Cần style guide naming prefix khi import component có domain.
- Component cross-stack: tên gốc, không prefix (vd `code-reviewer`).
- Khi 1 component chỉ có 1 phiên bản trong toàn repo → không prefix.

---

### CQ-1c — Copy vào core hay symlink/submodule giữ nguyên upstream

**Vấn đề**: Khi import 1 component từ ECC/anthropic-skills vào core, copy nội dung vào
repo dotclaude hay giữ submodule + symlink?

**Vì sao**: Owner ghi "**tự sở hữu nội dung**" và "có thể clone với chỉnh sửa" → khả
năng cao là copy. Nhưng cần xác nhận vì copy đồng nghĩa với mất link upstream auto-update.

**Options**:
- **A. Copy file vào `core/`**, lưu metadata nguồn riêng. Update là thao tác thủ công
  (re-pull upstream, diff, cherry-pick).
- **B. Giữ submodule trong `vendor/`, symlink vào `core/`**. Update chỉ cần `git submodule
  update --remote`. Nhưng modify component sẽ break symlink.
- **C. Hybrid**: copy với component cần modify, symlink với component dùng nguyên.

**Trade-off**: A cho ownership đầy đủ + tự do modify, đổi lại trách nhiệm sync. B
auto-update nhưng không modify được. C phức tạp, 2 cơ chế song song.

**Recommendation**: A — vì owner đã ghi "tự sở hữu" và sẵn sàng modify. Submodule chỉ
giữ làm reference đọc khi sync (không phải runtime).

**Status**: answered (2026-05-07)

**Decision**: **A — Copy thuần**. claudekit/ là source of truth. Provenance lưu trong
sidecar `<name>.source.json` (commit gốc, modified flag, ...). Cần `scripts/sync-from-upstream.sh`
để pull upstream → diff → owner quyết merge/skip.

**Hệ quả**:
- Vendor/upstream submodule giữ làm "source để diff", không phải runtime (xác nhận thêm ở CQ-7).
- Không có symlink trong claudekit/ → portable cross-machine, không phụ thuộc absolute path.

---

### CQ-1d — Cách handle modify component upstream

**Vấn đề**: Khi 1 component được clone rồi modify, làm sao track diff với upstream để
sau này merge update?

**Vì sao**: Nếu upstream sửa cùng phần → conflict. Cần biết phần nào đã modify.

**Options**:
- **A. Patch file**: lưu `.patch` trong `core/<type>/<name>.patch`, file gốc unchanged,
  apply patch khi install. Update = re-apply patch lên upstream mới.
- **B. Edit thẳng + diff trong metadata**: file modify trực tiếp, metadata ghi
  `modified: true` + summary. Khi sync upstream chạy `git diff` thủ công.
- **C. Branch theo component**: mỗi component modify là 1 branch trong dotclaude track
  upstream của nó. Phức tạp, không khuyến nghị.

**Trade-off**: A thuần tuý, dễ rebase nhưng khó đọc/edit. B simple, dễ edit nhưng phải
nhớ bookkeeping. C overkill cho personal repo.

**Recommendation**: B — pragmatic cho personal repo. Metadata sidecar đã track nguồn +
commit gốc + flag modified, thế là đủ. Khi nào upstream sửa nhiều mới cần A.

**Status**: answered (2026-05-07)

**Decision**: **B — Edit thẳng + sidecar flag**. File trong claudekit/ là file thực dùng.
Sidecar ghi `modified: bool` + `modifications: <text>`. Sync workflow dùng `git diff
<source_commit>..upstream <source_path>` để show diff, owner quyết merge thủ công từng
phần.

**Hệ quả**:
- Sidecar bắt buộc có field `source_commit` chính xác để diff hoạt động.
- Khi modify, owner phải nhớ update `modifications` field (có thể tự nhắc qua hook
  PostToolUse trên sidecar's directory).
- Không cần lưu snapshot riêng — git history của upstream submodule là đủ.

---

## CQ-2 — Provenance metadata format

Liên quan: REQ-1.

**Vấn đề**: Ghi nguồn upstream của mỗi component ở đâu, format gì?

**Vì sao**: Owner yêu cầu "**file ghi chú nguồn riêng biệt cho từng phần**" → cần thống
nhất format để installer/script đọc được + người đọc dễ hiểu.

**Options**:
- **A. Per-file frontmatter**: thêm field `source:` vào YAML frontmatter có sẵn của
  agent/skill/command. Chỉ work cho file md có frontmatter. Hooks (json) + commands
  không có frontmatter sẽ phải dùng format khác → không thống nhất.
- **B. Sidecar file**: mỗi component có file `<name>.source.json` cạnh nó (vd
  `core/agents/code-reviewer.md` + `core/agents/code-reviewer.source.json`). Format
  thống nhất, cover mọi loại file. Đổi lại tăng số file.
- **C. Manifest tập trung**: 1 file `core/PROVENANCE.json` liệt kê toàn bộ. 1 chỗ scan
  nhanh nhưng dễ drift khi sửa file mà quên update manifest.
- **D. Hybrid B+C**: sidecar mỗi file (source of truth), 1 manifest tổng được generate
  từ sidecar (source of read-only).

**Recommendation**: B (sidecar) — owner ghi rõ "riêng biệt cho từng phần" → mỗi
component có file source riêng đúng tinh thần. D có thể thêm sau nếu cần lookup nhanh.

**Status**: answered (2026-05-07)

**Decision**: **Sidecar YAML**, layout phân biệt theo loại component:
- File-component (agent/command/hook/rule, mỗi component là 1 file): sidecar
  `<name>.source.yaml` cạnh file. Vd `claudekit/agents/code-reviewer.md` +
  `claudekit/agents/code-reviewer.source.yaml`.
- Folder-component (skill, mỗi component là folder): sidecar `SOURCE.yaml` **bên trong**
  folder skill. Vd `claudekit/skills/coding-standards/{SKILL.md, assets/, SOURCE.yaml}`.
  Installer phải **exclude `SOURCE.yaml`** khi copy folder sang target.

**Fields**:
```yaml
source:
  repo: https://github.com/affaan-m/everything-claude-code
  commit: abc123def456
  path: agents/code-reviewer.md
  ref: main
imported_at: 2026-05-07
license: MIT
modified: false
modifications: null   # text mô tả khi modified: true
notes: null
```

**Hệ quả**:
- Cần dependency parser YAML (yq hoặc Python/Node) → installer KHÔNG còn pure-bash
  awk như skeleton cũ. Chấp nhận trade-off.
- Installer khi copy skill folder phải dùng `rsync --exclude=SOURCE.yaml` hoặc filter
  thủ công.
- Có thể có 1 file index `claudekit/MANIFEST.yaml` được generate từ tất cả sidecar
  (Phase 2 nếu cần lookup nhanh).

---

## CQ-3 — Preset format & schema

Liên quan: REQ-2.

### CQ-3a — Schema JSON cho preset

**Vấn đề**: Preset JSON gồm field gì?

**Đề xuất**:
```json
{
  "name": "typescript-fullstack",
  "kind": "framework",
  "description": "Next.js + Node + Postgres TS preset",
  "extends": ["base-typescript"],
  "components": {
    "agents": ["code-reviewer", "tdd-guide"],
    "skills": ["coding-standards", "frontend-patterns"],
    "commands": [],
    "hooks": [],
    "rules": []
  },
  "settings_patch": {
    "allowedTools": ["..."]
  },
  "version": "0.1.0"
}
```

**Status**: answered (2026-05-07)

**Decision** — Schema phase 1 (revised 2026-05-07: format chuyển từ JSON → YAML để dễ
đọc khi viết tay):
```yaml
# yaml-language-server: $schema=../../schema/preset.schema.json
name: typescript-fullstack
kind: framework  # framework | core | purpose
description: ...
version: 0.1.0
extends: []
components:
  agents: []
  skills: []
  commands: []
  hooks: []
  rules: []
settings_patch: {}
tags: []
```

**Note format**: schema file `preset.schema.json` vẫn là JSON Schema (chuẩn cross-IDE).
Preset YAML dùng comment header `# yaml-language-server: $schema=...` để VS Code YAML
extension validate.

Field bao gồm:
- `target_levels`: **KHÔNG**. Owner tự nhớ level phù hợp.
- `settings_patch`: **CÓ**. Snippet JSON deep-merge vào settings.json target. Installer
  phải implement deep-merge + conflict policy.
- `mcp_servers`: **defer Phase 2**. Phase 1 chưa kéo MCP qua preset.
- `extends`: **CÓ ngay** (xem CQ-3b bên dưới).
- `tags`: **CÓ**. Array string để filter (`claudekit list --tag fullstack`).

### CQ-3b — `extends:` ngay hay phase 2?

**Vấn đề**: Implement inheritance giữa các preset ngay đợt redesign, hay defer?

**Trade-off**: Implement ngay → schema phức tạp hơn, nhưng tránh refactor sau. Defer →
phase đầu nhanh, schema gọn.

**Status**: answered (2026-05-07)

**Decision**: **CÓ ngay**. Field `extends: [<preset-name>, ...]` từ phase 1.

**Edge cases cần handle khi implement** (note để generate plan tính tới):
- Multiple inheritance: `extends: ["base-typescript", "base-postgres"]` → merge tree.
- Diamond inheritance: A→B, A→C, B→D, C→D → tránh apply D 2 lần.
- Circular dependency: detect + abort với error rõ ràng.
- Component conflict: 2 parent đều list `code-reviewer` → idempotent, OK; 2 parent có
  `settings_patch` cùng key khác value → conflict, cần policy (last-wins / error).
- Override / exclude: child có cách "remove" component từ parent không? Phase 1 đề
  xuất KHÔNG (chỉ append), giữ schema gọn. Owner xác nhận khi gặp use case thật.

**Status**: answered (2026-05-07)

### CQ-3c — Phân loại theo `kind` (framework/core/purpose)

**Vấn đề**: Trục framework/core/purpose nằm trong field `kind` (flat presets/), hay
folder riêng (`presets/framework/`, `presets/core/`, `presets/purpose/`)?

**Trade-off**: Field `kind` flat — dễ scan, đỡ navigate. Folder — nhiều preset thì gọn
mắt nhưng path dài.

**Recommendation**: Flat `presets/<name>.json` + field `kind` — đơn giản, dễ list. Khi
nhiều preset (>20) mới cần group folder.

**Status**: answered (2026-05-07)

**Decision**: **Folder theo kind**. Layout:
```
presets/
├── core/
├── framework/
├── purpose/
└── README.md
```
Path canonical của preset = `presets/<kind>/<name>.json`. Kind field trong JSON vẫn
giữ (redundant với path nhưng cần cho schema validation + extends reference).

**Hệ quả**:
- Đổi kind = `mv` file giữa folder.
- Extends reference: chốt cụ thể khi implement (name-only auto search vs qualified
  `core/base-typescript`).

### CQ-3d — Markdown song song JSON

**Vấn đề**: Mỗi preset có cần `.md` đi kèm `.json` không, vai trò gì?

**Options**:
- **A. Chỉ JSON**: installer-readable, README chung ở `presets/README.md`.
- **B. JSON + MD**: JSON cho installer, MD cho human docs (rationale, when to use).
- **C. MD frontmatter + body**: 1 file duy nhất, frontmatter là JSON-equivalent,
  body là docs. Installer đọc frontmatter.

**Recommendation**: C — 1 file `<name>.md` với frontmatter YAML. Match Claude
convention (agents/skills cũng frontmatter + body). Installer parse frontmatter (có thể
JSON hoặc YAML).

**Status**: answered (2026-05-07)

**Decision** (revised 2026-05-07: JSON → YAML): **YAML + MD per preset**. Mỗi preset
có 2 file cùng tên khác đuôi:
```
presets/<kind>/<name>.yaml   # installer đọc, schema-validated qua zod + JSON Schema
presets/<kind>/<name>.md     # human docs: when to use, rationale, examples
```

Installer chỉ đọc YAML qua `js-yaml` + zod. MD chỉ docs. Tên file phải sync 1-1 (lint
script verify). Owner đã reject option "frontmatter MD" để tách biệt rõ machine vs human.

---

## CQ-4 — `private/` placement

Liên quan: REQ-3.

### CQ-4a — Đặt `private/` ở cấp nào?

**Vấn đề**: "Mỗi phần có folder private" — phần là cấp nào?

**Options**:
- **A. Root**: 1 folder `private/` ở root, mirror full structure
  (`private/core/agents/...`, `private/presets/...`).
- **B. Per package**: `core/private/`, `presets/private/`, `plugins/private/`.
- **C. Per component type**: `core/agents/private/`, `core/skills/private/`, ...
  Mirror sâu nhất.

**Trade-off**: A — 1 chỗ ignore, dễ git, scan rõ. B — gần component nhưng phải nhớ
nhiều rule ignore. C — sát file nhất nhưng đụng vào structure mỗi loại.

**Recommendation**: A. 1 quy tắc gitignore (`/private/`) cover toàn bộ. Installer scan
`private/<mirror-path>` parallel với public path. Đơn giản nhất khi grow.

**Status**: answered (2026-05-07)

**Decision**: **B — mỗi top package có private/**. Layout:
```
claudekit/private/   (gitignored)
presets/private/     (gitignored)
plugins/private/     (gitignored, sau này)
```
.gitignore khai mỗi rule riêng.

### CQ-4b — Cấu trúc trong `private/`

**Vấn đề**: `private/` mirror cấu trúc public (vd `private/core/agents/foo.md`) hay
free-form?

**Recommendation**: Mirror — installer dùng cùng logic, chỉ swap base path. Free-form
gây ad-hoc khó tự động.

**Status**: answered (2026-05-07)

**Decision**: **Mirror public**. `claudekit/private/{agents,skills,commands,hooks,rules}/`
+ `presets/private/{core,framework,purpose}/`. Installer khi resolve component ID:
search public path trước, sau đó fallback private path. Preset reference được private
component bằng ID phẳng.

### CQ-4c — `private.example/` template

**Vấn đề**: Có cần thư mục `private.example/` (track git, có example) để hướng dẫn
người clone repo cách dùng `private/` không?

**Trade-off**: Có — dev mới biết cách init. Không — repo cá nhân, owner biết rồi.

**Recommendation**: Có nhưng tối giản. 1 file `private/.gitkeep` + `private.example/README.md`
giải thích. Khi open source / share thì hữu ích.

**Status**: answered (2026-05-07)

**Decision**: **Có private.example/** ở mỗi top package. Skeleton tối thiểu:
```
claudekit/private.example/
├── README.md         # giải thích convention + ví dụ usecase
└── agents/.gitkeep   # mirror skeleton
presets/private.example/
├── README.md
└── framework/.gitkeep
```
+ `scripts/init-private.sh` copy mọi `private.example/` → `private/` cho máy mới.

### CQ-4d — Multi-machine bootstrap cho `private/`

**Vấn đề**: `private/` không track git → bootstrap máy mới thì lấy nội dung từ đâu?

**Options**:
- **A. Manual copy** (USB / cloud sync / 1Password file).
- **B. Repo private riêng** `dotclaude-private` → clone vào `private/`.
- **C. Symlink từ dotfiles repo** owner đã có.
- **D. Chưa cần lo, giải quyết sau**.

**Recommendation**: B — clean separation, version-control được, rotate dễ. Submodule
hoặc git clone manual đều OK.

**Status**: answered (2026-05-07)

**Decision**: **A — Manual copy / cloud sync**. Owner đồng bộ private content qua
phương tiện riêng (iCloud/Dropbox/USB/1Password). Repo dotclaude KHÔNG quản lý
distribution. `docs/PRIVATE.md` ghi convention + nhắc nhở backup.

**Hệ quả**: không có submodule cho private, không có script auto-sync. Nếu sau này
owner muốn versioning thì refactor sang B.

---

## CQ-5 — Install levels & semantics

Liên quan: REQ-4.

### CQ-5a — Levels cần support

**Vấn đề**: Phase đầu cover những level nào?

**Levels theo Claude convention**:
- User: `~/.claude/{agents,skills,commands,hooks/scripts}/`, `~/.claude/settings.json`,
  `~/.claude.json` (MCP).
- Project: `<repo>/.claude/...`, `<repo>/.mcp.json`, `<repo>/CLAUDE.md`.
- Plugin: `~/.claude/plugins/<name>/...` (Claude plugin model).
- Plugin marketplace: `~/.claude/plugins.json` hoặc command `/plugin install`.

**Options**:
- **A. Phase 1 chỉ user + project**, plugin/marketplace ở phase sau.
- **B. Cover tất cả ngay**, complexity cao.

**Recommendation**: A — phase 1 user + project (đa số use case). Plugin/marketplace
treat ở CQ-6 và phase sau.

**Status**: answered (2026-05-07)

**Decision**: **A — User + Project only**. Phase 1 cover `~/.claude/` + `<repo>/.claude/`.
Plugin/MCP defer.

### CQ-5b — Copy vs symlink default

**Vấn đề**: Action mặc định khi install — copy hay symlink?

**Options**:
- **A. Copy default**: `--symlink` flag để override. An toàn, không phụ thuộc dotclaude
  path. Nhưng sửa core không tự áp dụng.
- **B. Symlink default**: `--copy` flag. Sửa core auto áp dụng. Phụ thuộc absolute path.
- **C. Hybrid theo target**: user level symlink (dev workflow), project level copy
  (project standalone, có thể commit `.claude/`).

**Recommendation**: C — match thực tế dùng. User dùng cá nhân nên live link tiện. Project
copy để share với teammate / CI mà không cần dotclaude.

**Status**: answered (2026-05-07)

**Decision**: **C — Hybrid**. User level mặc định symlink, project level mặc định copy.
Flags `--copy` / `--symlink` override. Khi symlink, lưu absolute path tới
`/<dotclaude-root>/claudekit/...`.

### CQ-5c — Conflict policy

**Vấn đề**: File đã tồn tại ở target thì xử lý sao?

**Options**:
- **A. Skip with warning**: an toàn, không destroy.
- **B. Overwrite**: idempotent rerun, mất file thủ công của user.
- **C. Backup-then-overwrite**: tạo `<file>.bak`, an toàn + rerun OK.
- **D. Prompt interactive**: chậm, không scriptable.

**Recommendation**: C default + flag `--force` (skip backup) + `--skip-existing`.

**Status**: answered (2026-05-07)

**Decision**: **Backup-then-overwrite default**. Backup naming
`<file>.bak.<YYYYMMDD-HHMMSS>` để không đụng nhau. Flags:
- `--force`: overwrite không backup (idempotent re-run sạch sẽ)
- `--skip-existing`: bỏ qua file đã có
- `--prompt`: hỏi y/n từng file

Có script `scripts/clean-backups.sh` xoá `.bak.*` cũ hơn N ngày.

### CQ-5d — Idempotent + uninstall

**Vấn đề**: Re-run install lần 2 phải an toàn (idempotent). Có cần `uninstall`?

**Recommendation**: Idempotent là MUST. Uninstall — nice-to-have phase 2 (cần manifest
tracking ở CQ-5e trước).

**Status**: answered (2026-05-07)

**Decision**: Idempotent **MUST** ở Phase 1. Uninstall **defer Phase 2**.

### CQ-5e — Install manifest tracking

**Vấn đề**: Có cần ghi lại "install này đã put những file gì ở đâu" để uninstall/diff/upgrade
biết được không?

**Options**:
- **A. Có**: file `~/.claude/.dotclaude-manifest.json` (hoặc per-target). Liệt kê file
  installed, source preset, version, timestamp.
- **B. Không**: stateless, mỗi lần install là full replace. Đơn giản nhưng khó cleanup.

**Recommendation**: A. Cần cho uninstall + upgrade smart + audit. Đáng làm phase 1.

**Status**: answered (2026-05-07)

**Decision** (revised 2026-05-07: JSON → YAML): **A — Có manifest ngay Phase 1**. File:
- User: `~/.claude/.dotclaude-manifest.yaml`
- Project: `<repo>/.claude/.dotclaude-manifest.yaml`

Schema sơ bộ:
```yaml
schema_version: 1
installed_at: 2026-05-07T14:30:12Z
presets:
  - name: typescript-fullstack
    version: 0.1.0
    kind: framework
components:
  - type: agent
    id: code-reviewer
    target_path: ~/.claude/agents/code-reviewer.md
    mode: symlink
    source_path: /path/to/dotclaude/claudekit/agents/code-reviewer.md
    source_commit: abc123
    preset: typescript-fullstack
    auto_included: false      # explicit trong preset.components
    required_by: []
  - type: skill
    id: coding-standards
    target_path: ~/.claude/skills/coding-standards/
    mode: symlink
    source_path: /path/to/dotclaude/claudekit/skills/coding-standards/
    source_commit: abc123
    preset: typescript-fullstack
    auto_included: true       # kéo qua dep, không list trong preset
    required_by:
      - "agent:code-reviewer"
settings_patches:
  - preset: typescript-fullstack
    patch_keys:
      - hooks.PostToolUse[0]
external_deps:
  - name: prettier
    type: npm
    version_required: ">=3.0"
    found: false
    requested_by:
      - "hook:format-on-save"
```

**Edge cases note plan**:
- Multi-preset chồng nhau (preset A và B đều install code-reviewer): manifest gộp
  thành mảng `presets` per component.
- Reinstall: manifest cập nhật, không append duplicate.
- File ở target không thuộc manifest: audit command list ra cho owner quyết.

---

## CQ-6 — Marketplace & plugin

Liên quan: REQ-5.

### CQ-6a — Marketplace target

**Status**: answered (2026-05-07)

**Decision**: **B — Self-hosted marketplace**. Repo riêng `phantien133/claudekit-marketplace`
chứa `marketplace.json` index + folder `plugins/`. User add 1 lần qua
`/plugin marketplace add phantien133/claudekit-marketplace`, sau đó `/plugin install <name>`.

### CQ-6b — Quan hệ preset ↔ plugin

**Status**: answered (2026-05-07)

**Decision**: **A — 1-1**. Mỗi preset = 1 plugin standalone. Build pipeline: preset
JSON → resolve toàn bộ components (kể cả qua extends) → đóng gói plugin. Component
duplicate giữa các plugin — chấp nhận trade-off cho đơn giản (mỗi plugin
self-contained).

### CQ-6c — Phase

**Status**: answered (2026-05-07)

**Decision**: **A — Phase cuối**. Làm sau khi core + presets + install user/project
đã ổn và có ít nhất 1-2 preset thật. Trước khi build pipeline plugin, verify Claude
plugin model hiện tại (đọc docs Anthropic mới nhất + everything-claude-code + cookbook
để biết format manifest, cách marketplace hoạt động).

---

## CQ-7 — Vendor strategy hậu redesign

Liên quan: REQ-1, R4.

**Vấn đề**: Sau khi core là copy có ownership, `vendor/` còn tồn tại không và ở vai trò
gì?

**Options**:
- **A. Bỏ submodule runtime** (everything-claude-code), giữ 3 cái còn lại làm docs ở
  thư mục khác (vd `references/` thay vì `vendor/`).
- **B. Giữ submodule ECC như "source of sync"**: dùng để diff/pull khi cần update core.
  Không phải runtime.
- **C. Bỏ tất cả submodule**, chỉ ghi link trong docs khi cần xem upstream.

**Recommendation**: B + rename `vendor/` → `upstream/` để rõ semantics (không phải
vendored runtime nữa).

**Status**: answered (2026-05-07)

**Decision**: **A — Rename `vendor/` → `upstream/`**. Giữ cả 4 submodule cùng folder
(everything-claude-code, anthropic-cookbook, anthropic-skills, mcp-servers). ECC role
chuyển từ runtime → "source để sync" cho `scripts/sync-from-upstream.sh`. 3 cái còn lại
là docs reference. Tên `upstream/` reflect đúng semantics.

---

## CQ-8 — Phase ordering

**Vấn đề**: Plan chia phase thế nào, làm gì trước?

**Status**: answered (2026-05-07)

**Decision** — 5 phase chính:

- **Phase 0**: Cleanup skeleton (wipe `packages/` + `scripts/`, rename `vendor/` →
  `upstream/`).
- **Phase 1**: Core foundation. claudekit/ layout (type-first), sidecar provenance,
  presets layout (folder theo kind, JSON+MD), private.example/, 1 component thật từ
  ECC + 1 preset thật, sync-from-upstream script, docs/PRIVATE.md.
- **Phase 2**: Install pipeline (user symlink + project copy, backup-then-overwrite,
  manifest tracking, settings_patch deep-merge, extends resolver, init-private).
- **Phase 3**: Lifecycle (uninstall, upgrade, clean-backups).
- **Phase 4**: Marketplace + plugin (verify Claude plugin model, build-plugin, repo
  claudekit-marketplace, publish flow).

**Phase 5+ defer**: mcp_servers, plugin level install, target_levels, extends override/
exclude, tags filter command.

---

## CQ-10 — Ngôn ngữ implementation cho scripts

Liên quan: REQ-4 (install scripts), R2 (parser fragile).

**Vấn đề**: Scripts viết bằng Bash, TypeScript, Python, hay hybrid?

**Pain points của Bash cho dotclaude**:
- YAML parser cần `yq` (external Go binary).
- JSON Schema validation cần shell out.
- Deep-merge JSON với conflict policy phức tạp.
- Resolve `extends` tree (CQ-3b) → đệ quy bash + dedupe + circular detect là pain.
- Cross-platform: macOS BSD vs Linux GNU khác nhau (`sed -i`, `realpath`, `mktemp`).
- Test framework yếu (bats/shunit2 nặng).

**TypeScript + Bun ưu**:
- Lib mature: `zod`, `js-yaml`, `ajv`, `deepmerge`, `commander`.
- Type-safe schema (preset/manifest/sidecar) → catch lỗi compile-time + IDE autocomplete.
- Cross-platform tự nhiên.
- Vitest + fs mocks dễ test.
- Owner full-stack TS background → familiar, không có learning curve.
- Bun shebang `#!/usr/bin/env bun` chạy `.ts` trực tiếp.

**Status**: answered (2026-05-07)

**Decision**: **A — 100% TypeScript + Bun**. Scripts là `.ts`, chạy qua `bun`. Layout:
```
scripts/
├── install.ts                  # entry, commander
├── install-user.ts
├── install-project.ts
├── sync-from-upstream.ts
├── init-private.ts
├── clean-backups.ts
├── lib/
│   ├── schema.ts               # zod schemas (preset, sidecar, manifest)
│   ├── resolver.ts             # extends resolver, component lookup
│   ├── manifest.ts             # read/write .dotclaude-manifest.json
│   ├── settings-merge.ts       # deep-merge JSON
│   ├── sidecar.ts              # parse SOURCE.yaml + <name>.source.yaml
│   ├── fs-ops.ts               # symlink/copy/backup helpers
│   └── logger.ts               # uniform output
└── tests/
    └── *.test.ts               # Vitest
package.json
tsconfig.json
vitest.config.ts
```

**Hệ quả**:
- Repo cần Bun (≥1.0) cài sẵn. README hướng dẫn install Bun.
- `package.json` track deps: `zod`, `js-yaml`, `@types/js-yaml`, `commander`, `deepmerge`,
  `ajv`, `vitest`, `@types/node`.
- Mỗi entry script có shebang `#!/usr/bin/env bun` → chạy như executable.
- Tests trong `scripts/tests/` chạy bằng `bun test` hoặc `vitest`.
- TypeScript types xuất ra `scripts/lib/types.ts` reusable.
- CI (Phase 5+) chạy `bun test` + `bun run typecheck`.
- R2 (awk parser fragile) **được giải quyết hoàn toàn** ở Phase 2.

---

## CQ-12 — Inter-component dependencies trong sidecar

Liên quan: REQ-1 (claudekit core), REQ-4 (install scripts).

**Vấn đề**: Component có thể require component khác (agent require skill, skill require
hook, hook require external binary). Hiện sidecar chỉ track provenance — preset miss
component dep → install plan thiếu, target không hoạt động đúng.

**CQ-12a — Schema dependencies**:

**Status**: answered (2026-05-07)

**Decision**: **B — Full schema ngay (required/optional/external)**. Sidecar mở rộng:
```yaml
source: { ... }
imported_at: ...
modified: false
dependencies:
  required:
    agents: []
    skills: [coding-standards]
    commands: []
    hooks: []
    rules: []
  optional:
    agents: []
    skills: [python-patterns]
    commands: []
    hooks: []
    rules: []
  external:
    - name: prettier
      type: npm                # npm | system_binary | python_pkg
      version: ">=3.0"
      reason: "Hook format-on-save uses prettier"
    - name: jq
      type: system_binary
      version: ">=1.6"
      reason: "Hook parse JSON output"
```

**CQ-12b — Resolution policy**:

**Status**: answered (2026-05-07)

**Decision**: **A — Auto-include verbose**. Behavior:
- **required**: auto-add vào install plan, log rõ ràng `[deps] <component> requires: + <type>: <id> (auto-included)`.
- **optional**: skip default. Cần flag `--include-optional` để cài hết. Log mỗi dep
  optional bị skip để owner biết.
- **external**: warn-only. Installer chạy `which <binary>` hoặc check version, log
  FOUND/NOT FOUND. KHÔNG auto-install npm/binary (invasive). Owner cài thủ công.

**Resolver behavior**:
- Recursive resolution: A → B → C (nếu B require C, C cũng auto-add).
- Circular detection: A → B → A → abort với error rõ.
- Dedupe: cùng component được nhiều nguồn require → chỉ install 1 lần.
- Manifest ghi `auto_included: true` cho component được kéo qua dep (không phải
  explicit trong preset) để uninstall biết phân biệt.

**Hệ quả implementation**:
- Schema sidecar zod cần subschema cho dependencies + external.
- Resolver phải có 2 phase: (1) resolve preset extends + components, (2) resolve
  component dependencies (recursive).
- Output dry-run có section `[deps]` rõ ràng để owner review trước khi apply.
- Phase 5+ có thể auto-install external (`bun add prettier` hoặc `brew install jq`)
  qua flag `--auto-install-external` — defer, tránh invasive default.

---

## CQ-11 — Format chuẩn: JSON vs YAML cho file do owner control

Liên quan: CQ-3a, CQ-3d, CQ-5e (revise lại).

**Vấn đề**: Khi viết tay (preset, manifest), JSON cồng kềnh hơn YAML. Có nên đổi sang
YAML cho file mình control?

**Phân loại file**:

**Đổi được sang YAML (do dotclaude control)**:
- `presets/<kind>/<name>.yaml`
- `~/.claude/.dotclaude-manifest.yaml` + project equivalent
- `dependencies.yaml` (đã là YAML)
- Sidecar `<name>.source.yaml`, `SOURCE.yaml` (đã là YAML, CQ-2)

**KHÔNG đổi được (convention bên ngoài)**:
- `~/.claude/settings.json`, `~/.claude.json`, `<repo>/.mcp.json` — Claude Code/MCP convention
- `package.json`, `tsconfig.json` — npm/Bun convention
- `presets/schema/preset.schema.json` — JSON Schema chuẩn cross-IDE
- `marketplace.json`, `plugin.json` (Phase 4) — Anthropic plugin convention

**Status**: answered (2026-05-07)

**Decision**: **Đổi sang YAML cho mọi file owner control**. Specifically:
- Preset machine file: `.json` → `.yaml`. Schema validation qua header `# yaml-language-server: $schema=...` để VS Code YAML extension validate.
- Manifest: `.json` → `.yaml`.
- `settings_patch` trong preset YAML là YAML object → serialize JSON khi apply vào
  `settings.json` đích (qua `JSON.stringify`).

**Hệ quả**:
- Reuse `js-yaml` đã có deps cho cả sidecar + preset + manifest. Không thêm dep mới.
- TS layer: `loadPreset()` đọc YAML qua js-yaml, validate qua zod. `loadManifest()` cùng pattern.
- Schema TypeScript-first vẫn nguyên (zod), generate JSON Schema cho IDE preset YAML.

---

## CQ-9 — Migration từ skeleton hiện tại

**Vấn đề**: Skeleton (`packages/`, `scripts/`, `vendor/`) hiện không khớp design mới.
Xử lý sao?

**Options**:
- **A. Wipe & rewrite**: xóa `packages/`, `scripts/`, lên cấu trúc mới từ đầu. Giữ
  `docs/`, `dependencies.yaml` (nếu hợp), `vendor/` (nếu giữ).
- **B. Migrate dần**: refactor `packages/user/` → `core/`, `packages/presets/` → `presets/`,
  rewrite scripts. Bảo toàn git history per file.
- **C. Branch song song**: branch `redesign/v1` làm mới hoàn toàn, `main` skeleton cũ
  còn đó. Merge khi xong.

**Recommendation**: A. Skeleton chưa verify, content rỗng, git history mới 2 commit →
wipe sạch và build lại đỡ phức tạp hơn migrate. Vẫn giữ `docs/` (architecture reference)
và quyết định lại `vendor/` theo CQ-7.

**Status**: answered (2026-05-07)

**Decision**: **A — Wipe & rewrite**. Phase 0 thực hiện:
```bash
git rm -r packages/
git rm -r scripts/
git mv vendor upstream
git commit -m "chore: wipe skeleton, prepare for redesign"
```
Giữ: `docs/`, `CLAUDE.md`, `dependencies.yaml` (review nội dung sau), `upstream/` (đã
rename), `.gitmodules` (cập nhật path). Phase 1 bắt đầu build mới.

---

## Decisions log

> Khi 1 CQ answered, append summary vào đây để có view nhanh.

- **CQ-1a (2026-05-07)** — Top-level core: `claudekit/`. Layout flat: `claudekit/ +
  presets/ + plugins/ + scripts/`.
- **CQ-1b (2026-05-07)** — Internal layout: Type-first (ECC style). Naming prefix
  (`web-`, `python-`, ...) cho component domain-specific; cross-stack giữ tên gốc.
- **CQ-1c (2026-05-07)** — Import mode: Copy thuần. claudekit/ là source of truth.
  Cần script sync-from-upstream để diff/merge khi upstream cập nhật.
- **CQ-1d (2026-05-07)** — Modify tracking: Edit thẳng + sidecar `modified` flag +
  `modifications` text. Sync dùng `git diff source_commit..upstream`, không snapshot
  riêng, không patch file.
- **CQ-2 (2026-05-07)** — Sidecar YAML. File-component: `<name>.source.yaml` cạnh file.
  Folder-component (skill): `SOURCE.yaml` bên trong folder, installer exclude khi copy.
  Cần parser YAML (yq hoặc Node/Python).
- **CQ-3a (2026-05-07)** — Preset schema phase 1: name, kind, description, version,
  extends, components{agents,skills,commands,hooks,rules}, settings_patch, tags.
  KHÔNG có target_levels. Defer mcp_servers Phase 2.
- **CQ-3b (2026-05-07)** — extends CÓ ngay phase 1. Edge cases (multi/diamond/circular/
  conflict) phải handle trong installer. Phase 1 KHÔNG có override/exclude — chỉ append.
- **CQ-3c (2026-05-07)** — Preset layout: folder theo kind (`presets/{core,framework,
  purpose}/<name>.json`). Kind field giữ redundant trong JSON cho schema validation.
- **CQ-3d (2026-05-07)** — JSON + MD per preset, cùng tên khác đuôi. Installer đọc
  JSON, MD chỉ human docs. Lint verify 1-1.
- **CQ-4a (2026-05-07)** — private/ ở mỗi top package (claudekit/private/, presets/
  private/). Mirror cấu trúc public. Mỗi package gitignore rule riêng.
- **CQ-4b (2026-05-07)** — Cấu trúc trong private/ mirror public. Installer search
  public trước, fallback private khi resolve component ID.
- **CQ-4c (2026-05-07)** — Có private.example/ + scripts/init-private.sh. Skeleton tối
  thiểu (.gitkeep + README) cho máy mới.
- **CQ-4d (2026-05-07)** — Bootstrap private: manual / cloud sync. Repo dotclaude
  không quản lý distribution. docs/PRIVATE.md hướng dẫn.
- **CQ-5a (2026-05-07)** — Phase 1 install levels: User + Project. Plugin/MCP defer.
- **CQ-5b (2026-05-07)** — Hybrid mode: user=symlink default, project=copy default.
  Flags --copy/--symlink override.
- **CQ-5c (2026-05-07)** — Conflict policy: backup-then-overwrite default
  (.bak.<timestamp>). Flags --force, --skip-existing, --prompt.
- **CQ-5d (2026-05-07)** — Idempotent re-run MUST. Uninstall defer Phase 2.
- **CQ-5e (2026-05-07)** — Manifest tracking có ngay Phase 1.
  ~/.claude/.dotclaude-manifest.json + <repo>/.claude/.dotclaude-manifest.json.
- **CQ-6a (2026-05-07)** — Marketplace: self-hosted repo
  phantien133/claudekit-marketplace.
- **CQ-6b (2026-05-07)** — Preset ↔ plugin: 1-1, mỗi plugin self-contained.
- **CQ-6c (2026-05-07)** — Marketplace + plugin packaging: phase cuối, sau khi core +
  presets + install ổn.
- **CQ-7 (2026-05-07)** — Vendor strategy: rename `vendor/` → `upstream/`, giữ 4
  submodule cùng folder. ECC role: source để sync (không phải runtime).
- **CQ-8 (2026-05-07)** — Phase ordering: 5 phase (0 cleanup, 1 core foundation, 2
  install pipeline, 3 lifecycle, 4 marketplace).
- **CQ-9 (2026-05-07)** — Migration: wipe & rewrite. `git rm packages/ scripts/`,
  `git mv vendor upstream`, commit, build mới Phase 1.
- **CQ-10 (2026-05-07)** — Scripts language: 100% TypeScript + Bun. Zod cho schema,
  Vitest cho test. Repo cần `package.json` + `tsconfig.json`. Giải quyết R2 (parser
  fragile).
- **CQ-11 (2026-05-07)** — Format chuẩn: prefer **YAML** cho mọi file do owner control
  (preset → `.yaml`, manifest → `.yaml`). JSON giữ cho convention bên ngoài
  (settings.json, .mcp.json, package.json, tsconfig.json, JSON Schema, plugin manifest).
  Settings_patch trong preset là YAML object, serialize JSON khi apply vào target.
  Revisits: CQ-3a, CQ-3d, CQ-5e.
- **CQ-12 (2026-05-07)** — Inter-component dependencies trong sidecar:
  - 12a: schema full (required/optional/external) ngay Phase 1.
  - 12b: auto-include verbose. Required auto-add, optional skip default (flag
    --include-optional), external warn-only (no auto-install). Recursive resolution +
    circular detect + dedupe. Manifest đánh dấu `auto_included` cho component kéo qua
    dep.
