# PRESETS — Schema & Authoring Guide

> Preset là **pure manifest** trỏ vào component IDs trong `claudekit/`. Không chứa code.
>
> Schema TS-first (zod, `scripts/lib/schema.ts → PresetSchema`) → generate ra JSON
> Schema cho IDE validation (`presets/schema/preset.schema.json`).

## Cấu trúc thư mục (CQ-3c)

```
presets/
├── core/<name>.yaml + <name>.md       # baseline cross-stack
├── framework/<name>.yaml + <name>.md  # framework-specific (Next.js, Django, ...)
├── purpose/<name>.yaml + <name>.md    # task-specific (onboarding, hardening, ...)
├── private/                           # GITIGNORED — owner riêng (xem PRIVATE.md)
├── private.example/                   # TRACKED skeleton
└── schema/                            # JSON Schema được generate
```

Path canonical của 1 preset = `presets/<kind>/<name>.yaml`. Mỗi preset có 2 file:

- `.yaml` — machine-readable, schema-validated.
- `.md` — human docs (when to use, rationale, examples).

Tên file PHẢI sync 1-1 (lint trong validate command).

## Schema (CQ-3a/b/d)

```yaml
# yaml-language-server: $schema=../schema/preset.schema.json
name: typescript-fullstack            # lowercase kebab-case, match filename
kind: framework                        # core | framework | purpose, match folder
description: ...                       # 1 dòng, hiển thị trong list
version: 0.1.0                         # SemVer X.Y.Z
extends: []                            # parent preset names (CQ-3b)
components:
  agents: []                           # IDs trong claudekit/agents/
  skills: []                           # IDs trong claudekit/skills/
  commands: []
  hooks: []
  rules: []
settings_patch: {}                     # deep-merge vào ~/.claude/settings.json
tags: []                               # filter qua `pnpm run list --tag <t>`
```

### Field details

- **`name`**: lowercase kebab-case (`personal-baseline`, `nextjs-app`). Match
  filename strip `.yaml`.
- **`kind`**: `core | framework | purpose` — match folder.
  - `core`: cross-stack baseline.
  - `framework`: bound đến 1 framework cụ thể.
  - `purpose`: tập trung mục đích nhất định (onboarding, security audit, ...).
- **`description`**: 1 dòng tóm tắt khi nào dùng.
- **`version`**: SemVer. Bump khi thêm/bớt component, đổi behavior.
- **`extends`**: array tên parent preset. Resolver merge tree (CQ-3b):
  - Multiple inheritance OK: `extends: [base-typescript, base-postgres]`.
  - Diamond detect + dedupe.
  - Circular detect → throw.
  - Phase 1 chỉ append (không có `override`/`exclude`).
- **`components`**: 5 keys cố định (agents/skills/commands/hooks/rules), array
  string IDs.
  - Resolver lookup public trước, fallback private (CQ-4b).
  - Component sidecar's `dependencies.required` được auto-pulled (CQ-12).
- **`settings_patch`**: object deep-merge vào `~/.claude/settings.json` của target.
  Object YAML → serialize JSON khi apply.
- **`tags`**: tự do, dùng để filter trong list.

## Tạo preset mới

```bash
# 1. Chọn kind + name
KIND=core
NAME=my-baseline

# 2. Copy template
cp presets/core/personal-baseline.yaml presets/$KIND/$NAME.yaml
cp presets/core/personal-baseline.md   presets/$KIND/$NAME.md

# 3. Edit YAML — đổi name/description/components/tags

# 4. Validate
pnpm validate $NAME --kind $KIND

# 5. Verify list shows it
pnpm run list

# 6. Commit
```

## extends:

```yaml
# presets/framework/nextjs-app.yaml
name: nextjs-app
kind: framework
description: Next.js App Router preset (extends personal-baseline)
version: 0.1.0
extends:
  - personal-baseline    # tự kéo agents+skills của baseline
components:
  skills:
    - web-frontend-patterns
  hooks:
    - format-on-save
```

Resolver semantics khi compose:
1. Recursive resolve extends → merge components (set union per type).
2. settings_patch: deep-merge left-to-right, child wins on conflict.
3. Dedupe component theo `<type>:<id>`.

## Settings_patch

Phase 1 chưa apply (validate/list only). Phase 2 implement deep-merge:

```yaml
settings_patch:
  hooks:
    PostToolUse:
      - matcher: "Write|Edit"
        command: "pnpm prettier --write \"$FILE_PATH\""
```

Lưu ý: settings.json target là JSON. Preset YAML → nội dung YAML object → installer
deep-merge với existing JSON (qua `deepmerge` package) → write JSON.

Conflict policy (Phase 2 quyết định cụ thể, plan đề xuất):
- Object: deep-merge.
- Array: nối (concat) hoặc replace tuỳ field — sẽ implement với policy table.
- Scalar conflict: child wins, log warning.

## File reference

- `scripts/lib/schema.ts → PresetSchema` — zod schema.
- `scripts/lib/preset.ts` — locate/load/list helpers.
- `presets/schema/preset.schema.json` — generated JSON Schema cho IDE.
- `presets/core/personal-baseline.yaml` — first preset Phase 1.
