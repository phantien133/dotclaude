# personal-baseline

> Kind: `core` · Version: `0.1.0` · Tags: `baseline`, `cross-stack`

Cross-stack baseline preset áp dụng cho mọi project. Đây là preset đầu tiên owner cài
khi setup máy mới hoặc khởi tạo `~/.claude/` lần đầu.

## Khi nào dùng

- Setup user-level baseline trên máy mới: `pnpm install:user personal-baseline`.
- Kết hợp với 1 framework preset khác (vd `nextjs-app`) khi vào project: framework
  preset thường `extends: [personal-baseline]` để khỏi liệt kê lại baseline.

## Components installed

Trực tiếp qua `components`:

- `agents/code-reviewer` — agent review code chuyên sâu (CRITICAL/HIGH/MEDIUM/LOW
  taxonomy, confidence-based filtering).

Auto-included qua dependency resolver (đọc từ
`claudekit/agents/code-reviewer.source.yaml`):

- `skills/coding-standards` — required dep của `code-reviewer`. Skill cung cấp
  baseline conventions (naming, immutability, code-quality review).

## Why these two?

`code-reviewer` cần một bộ rule baseline để compare khi review — `coding-standards`
là skill rỗng-context-friendly, vào kit user-level đầu tiên là ngon nhất.

## Notes

- Khi 1 framework preset (vd Next.js) thêm component khác đè lên: deps resolver dedupe
  theo `<type>:<id>` → không install 2 lần.
- Nếu owner muốn loại `coding-standards` ra (ưu tiên skill khác), tạm thời chưa có
  cơ chế `exclude` trong preset extends (CQ-3b Phase 1 chỉ append). Workaround: viết
  preset baseline thay thế, không extends preset này.
