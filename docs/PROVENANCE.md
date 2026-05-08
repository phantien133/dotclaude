# PROVENANCE — Sidecar files

> Áp dụng cho mọi component trong `claudekit/` và `claudekit/private/`.

## Vì sao cần sidecar?

Component trong `claudekit/` là **copy có ownership** (CQ-1c). Để biết nó từ đâu ra,
commit nào, đã modify chưa, và phụ thuộc cái gì khi install — cần metadata cạnh
component.

Sidecar:
- Lưu provenance (repo + commit + path + license).
- Lưu `modified` flag + diff summary khi owner edit.
- Lưu inter-component dependencies (CQ-12) → resolver auto-include khi install.

Schema TS-first qua `zod` (xem `scripts/lib/schema.ts → SidecarSchema`). JSON Schema
được generate ra `presets/schema/sidecar.schema.json` cho IDE validation.

## Layout (CQ-2)

### File-component (agent / command / hook / rule — 1 file)

```
claudekit/agents/code-reviewer.md          ← component
claudekit/agents/code-reviewer.source.yaml ← sidecar
```

Sidecar có hậu tố `.source.yaml`, base name match component file (extension stripped).

### Folder-component (skill — folder với SKILL.md + assets)

```
claudekit/skills/coding-standards/
├── SKILL.md          ← component entry
├── SOURCE.yaml       ← sidecar (BÊN TRONG folder)
└── ...               ← các asset khác của skill
```

Sidecar luôn tên `SOURCE.yaml` ở root folder. **Installer phải EXCLUDE `SOURCE.yaml`
khi copy folder ra target** (`~/.claude/skills/<name>/` không nên có `SOURCE.yaml`).

## Schema

```yaml
# yaml-language-server: $schema=../../presets/schema/sidecar.schema.json
source:
  repo: https://github.com/<org>/<repo>     # URL upstream
  commit: <40-char SHA>                      # full commit SHA tại thời điểm import
  path: agents/code-reviewer.md              # path trong upstream
  ref: main                                  # branch/tag tracking
imported_at: 2026-05-08                     # ISO date YYYY-MM-DD
license: MIT                                 # license của upstream
modified: false                              # true nếu owner đã edit
modifications: null                          # text mô tả khi modified: true
notes: null                                  # ghi chú tự do (vd "vendored cho test deps flow")
dependencies:
  required:                                  # auto-installed bởi resolver
    agents: []
    skills: [coding-standards]
    commands: []
    hooks: []
    rules: []
  optional:                                  # skip default, --include-optional để bật
    agents: []
    skills: []
    commands: []
    hooks: []
    rules: []
  external:                                  # warn-only, không auto-install
    - name: prettier
      type: npm                              # npm | system_binary | python_pkg
      version: ">=3.0"
      reason: "Hook format-on-save uses prettier"
```

## Workflow vendor 1 component mới

```bash
# 1. Tìm component trong upstream
ls upstream/everything-claude-code/agents/

# 2. Copy nội dung (file-component)
cp upstream/everything-claude-code/agents/<name>.md claudekit/agents/<name>.md

# Hoặc folder-component
mkdir -p claudekit/skills/<name>
cp -r upstream/everything-claude-code/skills/<name>/* claudekit/skills/<name>/

# 3. Lấy commit pin
git -C upstream/everything-claude-code rev-parse HEAD

# 4. Tạo sidecar (copy template từ component khác làm starter)
$EDITOR claudekit/agents/<name>.source.yaml
# hoặc claudekit/skills/<name>/SOURCE.yaml

# 5. Verify schema
pnpm typecheck
pnpm test scripts/tests/preset-fixtures.test.ts
pnpm validate <preset-mention-this-component> --kind core   # nếu có preset
```

## Workflow modify component đã vendor

```yaml
# Sau khi edit claudekit/agents/code-reviewer.md
modified: true
modifications: |
  - Removed "ECC originated" line in intro.
  - Added section about dotclaude-specific review rubric.
```

Tip: `modifications` là multi-line literal. Cập nhật mỗi lần edit.

## Workflow sync upstream changes

```bash
# Diff sidecar.commit ↔ upstream HEAD theo path
pnpm sync agents/code-reviewer

# Output:
# - Nếu commit match HEAD → "No changes"
# - Nếu khác → diff hiển thị cho owner review
# Owner copy phần muốn merge vào claudekit/ thủ công, update sidecar.commit + bump
# modified flag nếu cần.
```

`pnpm sync` chỉ DIFF — không tự apply (Phase 1). Auto-merge nâng cao có thể thêm
sau qua `--apply` flag (Phase 5+).

## Dependency resolution (Phase 2 sẽ implement đầy đủ)

Resolver đọc `dependencies` block của mỗi component được install:

- **required**: auto-include vào install plan, log
  `[deps] code-reviewer requires: + skill: coding-standards (auto-included)`.
  Recursive: A → B → C all included.
- **optional**: skip mặc định. Pass `--include-optional` để cài hết. Log mỗi optional
  bị skip để owner biết.
- **external**: probe-only.
  - `type: npm` → check `pnpm ls --depth=0` (cwd target nếu là project, hoặc global).
  - `type: system_binary` → `which <name>`.
  - `type: python_pkg` → `pip show <name>`.
  - Log FOUND/NOT FOUND, version match. KHÔNG auto-install (Phase 5+ có thể qua flag).

Edge cases:
- **Circular**: A → B → A → resolver throw error rõ.
- **Diamond**: A → {B, C}, B → D, C → D → D include 1 lần (dedupe theo `<type>:<id>`).
- **Manifest tracking**: component được kéo qua dep có `auto_included: true`, plus
  `required_by: ["agent:code-reviewer"]` để uninstall biết phân biệt.

## File reference

- `claudekit/agents/code-reviewer.source.yaml` — first vendored agent (Phase 1).
- `claudekit/skills/coding-standards/SOURCE.yaml` — first vendored skill (Phase 1).
- `scripts/lib/schema.ts → SidecarSchema` — runtime + compile-time validation.
- `scripts/lib/sidecar.ts` — locate + load helpers.
- `scripts/sync-from-upstream.ts` — diff helper.
