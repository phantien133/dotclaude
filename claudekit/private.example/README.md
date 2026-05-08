# claudekit/private/ — Private overlays for personal/company-specific kit

`claudekit/private/` mirror cấu trúc public của `claudekit/`. Folder này là
**gitignored** ở repo root (`.gitignore` rule `/claudekit/private/`).

```
claudekit/private/
├── agents/
│   └── <my-private-agent>.md
│   └── <my-private-agent>.source.yaml   # nếu vendor từ upstream
├── skills/
│   └── <my-private-skill>/
│       ├── SKILL.md
│       └── SOURCE.yaml
├── commands/
├── hooks/
└── rules/
```

## Khi nào đặt component vào `private/`?

- **Company-specific**: agents/skills chứa workflow nội bộ, project name riêng
  của công ty.
- **Secrets-adjacent**: prompt mà nhắc tên hệ thống nội bộ, URL không public,
  username, ...
- **Personal experiments** chưa muốn share: agents đang try.
- **Forks chưa polished**: bản chỉnh đang test, sẽ promote lên public sau.

## Resolver behavior

Khi preset reference component ID phẳng (`code-reviewer`), installer:

1. Search `claudekit/<type>/<id>` (public) trước.
2. Fallback `claudekit/private/<type>/<id>` nếu không thấy.
3. Throw nếu cả 2 đều không có.

→ Có thể override component public bằng cách KHÔNG đặt cùng tên public; private
chỉ kick in khi public miss. Nếu muốn override, đặt tên private khác và sửa
preset reference.

## Bootstrap máy mới

Repo dotclaude **không quản lý distribution của private/**. Khi clone repo trên
máy mới:

1. Init skeleton: `pnpm init-private` (copy `claudekit/private.example/` →
   `claudekit/private/` + tương tự cho `presets/`).
2. Copy nội dung private từ nguồn riêng (iCloud / Dropbox / 1Password / USB
   drive). Xem `docs/PRIVATE.md` để biết convention owner đang dùng.

## Format component trong private

Hoàn toàn giống public — cùng frontmatter agent/skill convention. Nếu component
là vendored từ upstream với modification, vẫn cần sidecar `<name>.source.yaml`
hoặc `SOURCE.yaml` (cho skill folder) để track provenance.
