# preset: go-backend

Project-level config cho Go service / API / CLI.

## Đích cài

`<repo>/.claude/`

## Khi nào dùng

Repo có:
- `go.mod` ở root
- Go >= 1.21
- Backend service (HTTP/gRPC) hoặc CLI tool

## Cài

```bash
cd /path/to/your-go-project
~/path/to/dotclaude/scripts/install.sh preset go-backend
```

## Bao gồm

ECC skills (xem `deps.yaml`):
- `coding-standards`, `golang-patterns`, `golang-testing`
- `backend-patterns`, `api-design`, `postgres-patterns`

Plus: `CLAUDE.md.template`.
