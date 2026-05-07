# preset: python-django

Project-level config cho Django apps (Python).

## Đích cài

`<repo>/.claude/`

## Khi nào dùng

Repo có:
- `manage.py` ở root
- Django >= 4.x
- Django REST Framework (tùy chọn)

## Cài

```bash
cd /path/to/your-django-project
~/path/to/dotclaude/scripts/install.sh preset python-django
```

## Bao gồm

ECC skills (xem `deps.yaml`):
- `coding-standards`, `python-patterns`, `python-testing`
- `django-patterns`, `django-tdd`, `django-verification`
- `api-design`, `postgres-patterns`

Plus: `CLAUDE.md.template`.

## Security add-on

Khi repo handle PII/PHI hoặc public API, thêm vào `deps.yaml`:
```yaml
ecc_skills:
  - django-security
  - security-review
```

Rồi cài lại preset.
