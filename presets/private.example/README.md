# presets/private/ — Private presets

`presets/private/` mirror cấu trúc public của `presets/`. Folder này là
**gitignored** ở repo root (`.gitignore` rule `/presets/private/`).

```
presets/private/
├── core/
│   └── <my-private-baseline>.yaml
│   └── <my-private-baseline>.md
├── framework/
│   └── <internal-stack>.yaml
└── purpose/
```

## Khi nào tạo private preset?

- **Internal stack**: project nội bộ với tooling specific (vd Next.js + 1
  internal logging lib + auth dashboard riêng).
- **Per-project**: 1 project có config rất riêng, muốn 1 preset dùng cho mỗi
  project đó (ví dụ `presets/private/purpose/projectA-onboarding.yaml`).
- **Sensitive**: preset chứa references đến private component, internal MCP
  servers, internal markdown notes.

## Schema

Cùng schema như public preset (`presets/schema/preset.schema.json`). Header
YAML:

```yaml
# yaml-language-server: $schema=../../schema/preset.schema.json
```

Note path `../../schema/...` nếu private nằm sâu hơn 1 cấp.

## Resolver behavior

Cũng mirror logic component:

- `pnpm install:user my-private-baseline --kind core` → installer search
  `presets/core/my-private-baseline.yaml` (public) trước, fallback
  `presets/private/core/my-private-baseline.yaml`.
- Tên preset phải unique (kind + name) — public hay private đều cùng namespace
  cho `extends:`.

## Bootstrap máy mới

Same as `claudekit/private/`: copy nội dung từ nguồn riêng. Xem
`docs/PRIVATE.md`.
