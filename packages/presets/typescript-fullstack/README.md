# preset: typescript-fullstack

Project-level config cho stack Next.js / React / Node / NestJS / Prisma — fullstack TypeScript.

## Đích cài

`<repo>/.claude/`

## Khi nào dùng

Repo có:
- `package.json` với `typescript` dependency
- React / Next.js frontend, hoặc Node / NestJS backend, hoặc cả hai trong monorepo
- Prisma / Drizzle ORM (tùy chọn)

## Cài

```bash
cd /path/to/your-typescript-project
~/path/to/dotclaude/scripts/install.sh preset typescript-fullstack
```

Mặc định **symlink** skills về vendor ECC (không tăng repo size, update ECC tự động lan). Nếu muốn copy độc lập (vd repo cần self-contained, không phụ thuộc local ECC):

```bash
~/path/to/dotclaude/scripts/install.sh preset typescript-fullstack --copy
```

## Bao gồm

ECC skills (xem `deps.yaml`):
- `coding-standards`
- `frontend-patterns`
- `backend-patterns`
- `api-design`
- `mcp-server-patterns`
- `nestjs-patterns`

Plus: `CLAUDE.md.template` — render thành `<repo>/CLAUDE.md` nếu chưa tồn tại.

## Tweak cho repo cụ thể

Sau khi cài, sửa `<repo>/.claude/` và `<repo>/CLAUDE.md` thoải mái — preset là starting point, không sync ngược về dotclaude.

Nếu thấy pattern có thể tái sử dụng, đẩy ngược về `packages/presets/typescript-fullstack/skills/` (custom skills riêng cho preset, đè lên ECC).
