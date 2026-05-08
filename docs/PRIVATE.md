# PRIVATE — Convention & Bootstrap

## Mục đích

`private/` chứa overlays riêng tư của owner — thứ KHÔNG nên public:

- Company-specific agents/skills (workflow nội bộ, project name, URL không public).
- Personal experiments chưa polish (đang try, sẽ promote hoặc drop).
- Forks của upstream chưa stable.
- Preset cho project nội bộ với tooling specific.

## Layout (CQ-4a/b)

```
claudekit/private/                    # GITIGNORED
├── agents/<name>.md + <name>.source.yaml
├── skills/<name>/SKILL.md + SOURCE.yaml
├── commands/
├── hooks/
└── rules/

presets/private/                       # GITIGNORED
├── core/<name>.yaml + <name>.md
├── framework/
└── purpose/

claudekit/private.example/             # TRACKED skeleton
├── README.md (hướng dẫn)
└── {agents,skills,commands,hooks,rules}/.gitkeep

presets/private.example/               # TRACKED skeleton
├── README.md
└── {core,framework,purpose}/.gitkeep
```

## .gitignore rules (đã set)

```gitignore
/claudekit/private/
/presets/private/
/plugins/private/
```

Rule absolute (`/` đầu) → chỉ ignore folder ngay root, không ảnh hưởng nested folder
tên `private` ở chỗ khác.

## Resolver behavior

Khi preset reference component ID phẳng (`code-reviewer`):

1. Search `claudekit/<type>/<id>` (public) trước.
2. Fallback `claudekit/private/<type>/<id>` nếu không thấy public.
3. Throw nếu cả 2 đều miss.

→ Public component CÙNG TÊN với private = public win. Để override, đặt tên private
khác và sửa preset reference.

Same logic cho preset: `presets/<kind>/<name>.yaml` public trước, private fallback.

## Bootstrap máy mới (CQ-4d)

Repo dotclaude **không quản lý distribution** của private/. Owner tự lo qua:

- iCloud / Dropbox / Google Drive sync folder.
- 1Password Secure Note với attachments.
- USB drive (cho machine không có cloud).
- Repo private riêng (`dotclaude-private`) — không recommend default vì tăng cấp setup.

### Bootstrap flow

```bash
# 1. Clone dotclaude
git clone --recursive git@github.com:phantien133/dotclaude.git
cd dotclaude

# 2. Init private skeleton từ private.example/
pnpm init-private    # sẽ implement Phase 2 — copy private.example/ → private/

# 3. Restore nội dung từ nguồn riêng
cp -r ~/Documents/dotclaude-backup/claudekit/private/* claudekit/private/
cp -r ~/Documents/dotclaude-backup/presets/private/*   presets/private/

# 4. Verify
pnpm typecheck
pnpm run list                    # xem private presets có hiện không
pnpm validate <my-private-preset> --kind core
```

### Backup recommendation

Sau mỗi lần thêm/sửa private content:

```bash
# Backup tổng quát
rsync -av --delete claudekit/private/ ~/Documents/dotclaude-backup/claudekit/private/
rsync -av --delete presets/private/   ~/Documents/dotclaude-backup/presets/private/

# Hoặc dùng cloud sync folder làm target
```

## Convention khi viết private content

- Format hoàn toàn giống public (cùng frontmatter agent/skill convention).
- Vendored từ upstream + modified → vẫn cần sidecar (dùng để track + sync sau này).
- Naming có thể tự do hơn public, nhưng tránh trùng tên với public (resolver public-first).

## Khi nào promote private → public?

- Component đã stable + generic (không còn company-specific).
- Sẵn sàng share + accept feedback.
- Nội dung KHÔNG còn secret/internal references.

```bash
# Move file
git mv claudekit/private/agents/foo.md claudekit/agents/foo.md
git mv claudekit/private/agents/foo.source.yaml claudekit/agents/foo.source.yaml

# Update sidecar — strip company-specific paths trong source nếu có

# Commit
git commit -m "feat: promote agent foo from private to public"
```
