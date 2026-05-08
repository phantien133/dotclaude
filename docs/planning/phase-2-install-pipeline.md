# Phase 2 — Install Pipeline

> **Status**: PLANNING — cần co-plan cùng owner trước khi implement.
>
> **Prereq**: Phase 1 hoàn thành (commit `bf32a83`). Schema, sidecar, preset, validate,
> list, sync đều xanh. 15 tests pass.

## Goal

Cài 1 preset vào `~/.claude/` (user) hoặc `<cwd>/.claude/` (project) được — idempotent,
có manifest, có backup.

## Scope Phase 2

| Deliverable | File(s) |
|---|---|
| Resolver: extends tree + dep recursive | `scripts/lib/resolver.ts` |
| FS ops: symlink / copy / backup | `scripts/lib/fs-ops.ts` |
| Settings merge | `scripts/lib/settings-merge.ts` |
| Manifest read/write atomic | `scripts/lib/manifest.ts` |
| Install user command | `scripts/install.ts user` |
| Install project command | `scripts/install.ts project` |
| Init private skeleton | `scripts/init-private.ts` |
| Clean backups | `scripts/clean-backups.ts` |
| Tests đầy đủ | `scripts/tests/*.test.ts` |

---

## Milestones (cần review cùng owner)

### M1 — Resolver (pure, no fs)

**Input**: preset name → **Output**: `InstallPlan` (danh sách component + settings patch)

Steps:

- [ ] **M1.1** — `scripts/lib/resolver.ts`: `resolvePreset(name, kind?)` — load YAML, validate zod, trả `Preset`.
- [ ] **M1.2** — `resolveExtends(preset)` — đệ quy theo `extends[]`, detect circular (Set visited), diamond dedupe theo `<type>:<id>`.
- [ ] **M1.3** — `resolveComponents(preset)` — với mỗi component ID, lookup `claudekit/<type>/<id>` trước, fallback `claudekit/private/<type>/<id>`. Throw nếu miss cả 2.
- [ ] **M1.4** — `resolveDependencies(components, opts)` — đọc sidecar của từng component, kéo `required` deps vào plan (recursive), skip/include `optional` theo flag, probe `external` deps (system binary / npm / python_pkg) qua shell.
- [ ] **M1.5** — `buildInstallPlan(preset, opts)` — merge toàn bộ: deduped components, merged settings_patch, external warnings, dep log.
- [ ] **M1.6** — Tests `scripts/tests/resolver.test.ts`:
  - extends linear, diamond, circular-detect.
  - component public hit, private fallback, missing-throw.
  - deps: required auto-include recursive, optional skip/include, external probe mock, circular-dep-detect, dedupe.

**Done when**: `pnpm test resolver` xanh 100%.

---

### M2 — FS ops + Manifest

Steps:

- [ ] **M2.1** — `scripts/lib/fs-ops.ts`:
  - `backup(path)` → tạo `<path>.bak.<ISO-timestamp>` nếu path tồn tại.
  - `ensureDir(dir)` → `mkdir -p`.
  - `applySymlink(src, dst)` → `rm dst nếu tồn tại; ln -s src dst`.
  - `applyCopy(src, dst)` → `cp -r` (file) hoặc `copyFolder(src, dst, exclude=['SOURCE.yaml'])` (folder).
  - Guard: dst phải nằm trong target root (prevent path traversal).
- [ ] **M2.2** — `scripts/lib/settings-merge.ts`:
  - `mergeSettings(existing, patch)` → deep-merge (object merge, array concat). Object/scalar conflict: patch wins + log warning.
  - `loadSettings(path)` → `JSON.parse`, trả `{}` nếu không tồn tại.
  - `writeSettings(path, merged)` → backup trước, rồi write.
- [ ] **M2.3** — `scripts/lib/manifest.ts`:
  - Schema `ManifestSchema` trong `schema.ts` (YAML format).
  - `loadManifest(path)` → `null` nếu không tồn tại.
  - `writeManifest(path, manifest)` → write-tmp + rename (atomic).
  - `mergeManifest(old, newEntries)` → merge entries (multi-preset chồng). Track `auto_included: true` + `required_by: [...]` cho deps được kéo tự động.
- [ ] **M2.4** — Tests `scripts/tests/settings-merge.test.ts`, `manifest.test.ts`.

**Done when**: `pnpm test settings-merge manifest` xanh.

---

### M3 — `install:user` command

Steps:

- [ ] **M3.1** — `scripts/install.ts user <preset> [flags]` — wire commander subcommand.
  - Flags: `--copy | --symlink`, `--force | --skip-existing | --prompt`, `--include-optional`, `--dry-run`, `--target <path>` (override default `~/.claude`).
- [ ] **M3.2** — Default mode: **symlink** (CQ-5b). `--copy` để standalone.
- [ ] **M3.3** — Flow:
  1. `buildInstallPlan(preset, opts)`.
  2. Print plan nếu `--dry-run` (exit 0 sau print).
  3. Backup `settings.json`.
  4. Apply fs ops từ plan (symlink hoặc copy) với conflict policy.
  5. Apply settings_patch qua `mergeSettings`.
  6. Update manifest `~/.claude/.dotclaude-manifest.yaml`.
- [ ] **M3.4** — Idempotent re-run: nếu component đã cài đúng mode → skip, chỉ update timestamp manifest.
- [ ] **M3.5** — Smoke test thật với `personal-baseline --dry-run` → output đúng.
- [ ] **M3.6** — Smoke test install thật → kiểm tra file tại `~/.claude/agents/code-reviewer.md` + sidecar KHÔNG ở target + manifest tồn tại.

---

### M4 — `install:project` command

- [ ] **M4.1** — `scripts/install.ts project <preset> [flags]`.
  - Default mode: **copy** (CQ-5b cho project).
  - Target: `<cwd>/.claude/`.
  - Warn nếu `<cwd>` không có `.git/`.
- [ ] **M4.2** — Smoke test với `personal-baseline --dry-run` ở repo test.

---

### M5 — Utilities

- [ ] **M5.1** — `scripts/init-private.ts`:
  - Copy `claudekit/private.example/` → `claudekit/private/` + `presets/private.example/` → `presets/private/`.
  - Idempotent (skip nếu private đã có nội dung thực, không chỉ `.gitkeep`).
- [ ] **M5.2** — `scripts/clean-backups.ts`:
  - Scan `*.bak.YYYY*` cũ hơn `--days` ngày (default 30).
  - `--dry-run` list, không `--dry-run` thì xóa.
  - Scan `~/.claude/` + `<target>/.claude/` nếu được chỉ định.

---

### M6 — Docs update

- [ ] Update `docs/INSTALL.md` — thêm `install:user` + `install:project` + flags.
- [ ] Update `README.md` quickstart.

---

## Open questions Phase 2 (cần quyết trước khi implement)

### Q2-1 — Manifest location khi project install

Manifest của project install để ở `<cwd>/.claude/.dotclaude-manifest.yaml` — nhưng `.dotclaude-manifest.yaml` có track trong repo của project không? Hay gitignore?
- Option A: gitignore per-project (owner tự add vào `.gitignore` của project).
- Option B: dotclaude tự thêm vào `.gitignore` của project khi install.

### Q2-2 — Conflict policy default

Khi file đã tồn tại ở target, default policy là gì?
- Option A: `backup-then-overwrite` (safe nhất, tự động).
- Option B: `skip-existing` (idempotent nhất, nhưng stale nếu component update).
- Option C: `prompt` (safe, nhưng không headless-friendly).

### Q2-3 — Symlink source là absolute hay relative?

Symlink `~/.claude/agents/code-reviewer.md` → `/Users/tienphan/workspace/.../claudekit/agents/code-reviewer.md` (absolute).
Nếu dotclaude repo move, symlink broken. Cần document rõ hay có migration helper?

### Q2-4 — settings_patch array policy

Khi merge 2 preset có cùng key là array (vd `hooks.PostToolUse`), policy là gì?
- `concat`: append tất cả.
- `replace`: preset child thắng.
- `unique-merge`: concat nhưng dedupe theo `matcher`?

Đây là decision ảnh hưởng runtime behavior nhiều nhất.

### Q2-5 — Install skill folder: copy hay symlink?

Skill là folder. Khi install:
- Symlink toàn bộ folder `~/.claude/skills/coding-standards → /.../claudekit/skills/coding-standards`.
  - Pro: update tự động. Con: `SOURCE.yaml` vẫn expose trong folder (nhưng Claude không đọc file lạ).
- Copy folder, exclude `SOURCE.yaml`.
  - Pro: clean target. Con: phải re-install để update.

Quyết định ảnh hưởng `fs-ops.ts` + docs.

---

## Risks Phase 2

| Risk | Mitigation |
|---|---|
| Path traversal trong fs-ops | Guard: dst phải có prefix = target root; throw nếu không. |
| Circular preset extends | Detect với Set visited; throw rõ ràng. |
| settings.json corrupt khi interrupted | Backup trước; write-tmp + rename atomic. |
| Symlink broken khi move repo | Document rõ trong INSTALL.md; Phase 3 có `audit` để detect. |
