# Phase 2 — Install Pipeline

> **Status**: PLANNING — needs co-planning with owner before implementation.
>
> **Prereq**: Phase 1 complete (commit `bf32a83`). Schema, sidecar, preset, validate,
> list, and sync all green. 15 tests pass.

## Goal

Install a preset into `~/.claude/` (user) or `<cwd>/.claude/` (project) — idempotent,
with manifest tracking and backup support.

## Scope Phase 2

| Deliverable | File(s) |
|---|---|
| Resolver: extends tree + recursive deps | `scripts/lib/resolver.ts` |
| FS ops: symlink / copy / backup | `scripts/lib/fs-ops.ts` |
| Settings merge | `scripts/lib/settings-merge.ts` |
| Manifest read/write atomic | `scripts/lib/manifest.ts` |
| Install user command | `scripts/install.ts user` |
| Install project command | `scripts/install.ts project` |
| Init private skeleton | `scripts/init-private.ts` |
| Clean backups | `scripts/clean-backups.ts` |
| Full test suite | `scripts/tests/*.test.ts` |

---

## Milestones (to review with owner)

### M1 — Resolver (pure, no fs)

**Input**: preset name → **Output**: `InstallPlan` (component list + settings patch)

Steps:

- [ ] **M1.1** — `scripts/lib/resolver.ts`: `resolvePreset(name, kind?)` — load YAML, validate with zod, return `Preset`.
- [ ] **M1.2** — `resolveExtends(preset)` — recurse through `extends[]`, detect circular (Set visited), diamond dedupe by `<type>:<id>`.
- [ ] **M1.3** — `resolveComponents(preset)` — for each component ID, look up `claudekit/<type>/<id>` first, fallback to `claudekit/private/<type>/<id>`. Throw if both miss.
- [ ] **M1.4** — `resolveDependencies(components, opts)` — read each component's sidecar, pull `required` deps into plan (recursive), skip/include `optional` per flag, probe `external` deps (system binary / npm / python_pkg) via shell.
- [ ] **M1.5** — `buildInstallPlan(preset, opts)` — merge everything: deduped components, merged settings_patch, external warnings, dep log.
- [ ] **M1.6** — Tests `scripts/tests/resolver.test.ts`:
  - extends: linear, diamond, circular-detect.
  - component: public hit, private fallback, missing-throw.
  - deps: required auto-include recursive, optional skip/include, external probe mock, circular-dep-detect, dedupe.

**Done when**: `pnpm test resolver` is 100% green.

---

### M2 — FS ops + Manifest

Steps:

- [ ] **M2.1** — `scripts/lib/fs-ops.ts`:
  - `backup(path)` → create `<path>.bak.<ISO-timestamp>` if path exists.
  - `ensureDir(dir)` → `mkdir -p`.
  - `applySymlink(src, dst)` → remove dst if it exists; `ln -s src dst`.
  - `applyCopy(src, dst)` → `cp -r` (file) or `copyFolder(src, dst, exclude=['SOURCE.yaml'])` (folder).
  - Guard: dst must be within target root (prevent path traversal).
- [ ] **M2.2** — `scripts/lib/settings-merge.ts`:
  - `mergeSettings(existing, patch)` → deep-merge (object merge, array concat). Object/scalar conflict: patch wins + log warning.
  - `loadSettings(path)` → `JSON.parse`, return `{}` if file does not exist.
  - `writeSettings(path, merged)` → backup first, then write.
- [ ] **M2.3** — `scripts/lib/manifest.ts`:
  - Schema `ManifestSchema` in `schema.ts` (YAML format).
  - `loadManifest(path)` → `null` if file does not exist.
  - `writeManifest(path, manifest)` → write-tmp + rename (atomic).
  - `mergeManifest(old, newEntries)` → merge entries (multi-preset stacking). Track `auto_included: true` + `required_by: [...]` for automatically pulled dependencies.
- [ ] **M2.4** — Tests `scripts/tests/settings-merge.test.ts`, `manifest.test.ts`.

**Done when**: `pnpm test settings-merge manifest` is green.

---

### M3 — `install:user` command

Steps:

- [ ] **M3.1** — `scripts/install.ts user <preset> [flags]` — wire commander subcommand.
  - Flags: `--copy | --symlink`, `--force | --skip-existing | --prompt`, `--include-optional`, `--dry-run`, `--target <path>` (override default `~/.claude`).
- [ ] **M3.2** — Default mode: **symlink** (CQ-5b). `--copy` for standalone use.
- [ ] **M3.3** — Flow:
  1. `buildInstallPlan(preset, opts)`.
  2. Print plan if `--dry-run` (exit 0 after print).
  3. Backup `settings.json`.
  4. Apply fs ops from plan (symlink or copy) with conflict policy.
  5. Apply settings_patch via `mergeSettings`.
  6. Update manifest at `~/.claude/.dotclaude-manifest.yaml`.
- [ ] **M3.4** — Idempotent re-run: if a component is already installed in the correct mode → skip, only update manifest timestamp.
- [ ] **M3.5** — Smoke test with `personal-baseline --dry-run` → verify output is correct.
- [ ] **M3.6** — Smoke test real install → verify file at `~/.claude/agents/code-reviewer.md` + sidecar NOT in target + manifest exists.

---

### M4 — `install:project` command

- [ ] **M4.1** — `scripts/install.ts project <preset> [flags]`.
  - Default mode: **copy** (CQ-5b for project installs).
  - Target: `<cwd>/.claude/`.
  - Warn if `<cwd>` has no `.git/`.
- [ ] **M4.2** — Smoke test with `personal-baseline --dry-run` in a test repo.

---

### M5 — Utilities

- [ ] **M5.1** — `scripts/init-private.ts`:
  - Copy `claudekit/private.example/` → `claudekit/private/` + `presets/private.example/` → `presets/private/`.
  - Idempotent (skip if `private/` already has real content, not just `.gitkeep`).
- [ ] **M5.2** — `scripts/clean-backups.ts`:
  - Scan for `*.bak.YYYY*` files older than `--days` days (default: 30).
  - `--dry-run` lists without deleting; without `--dry-run` deletes them.
  - Scans `~/.claude/` + `<target>/.claude/` if specified.

---

### M6 — Docs update

- [ ] Update `docs/INSTALL.md` — add `install:user` + `install:project` + flags.
- [ ] Update `README.md` quickstart.

---

## Decisions Phase 2

### Q2-1 — Should the project install manifest be gitignored automatically?

**Decision**: Do NOT auto-add to the project target's `.gitignore`.
Installer only **suggests and highlights** it for the user (clear warning printed after install).

```
[warn] Consider adding to your project .gitignore:
       .claude/.dotclaude-manifest.yaml
```

**Impl note**: log warning after every `install:project` run. Do not modify any project file.

---

### Q2-2 — Conflict policy

**Decision**: interactive prompt when a conflict occurs; policy saved as shared config.

Flow:
1. First conflict encountered (file already exists at target) → prompt user:
   ```
   [conflict] ~/.claude/agents/code-reviewer.md already exists.
   How to handle? (b)ackup-overwrite / (s)kip / (o)verwrite / (a)lways-backup / (A)lways-skip
   ```
2. If user selects `always-*` → save to config (`~/.claude/.dotclaude-config.yaml` or
   dotclaude repo `config.yaml`) as the default for future runs.
3. If `--force` flag is present → backup-overwrite without prompting. `--skip-existing` → skip without prompting.

**Config schema** (add to `scripts/lib/schema.ts`):
```yaml
conflict_policy: backup-overwrite | skip | overwrite | prompt   # default: prompt
```

---

### Q2-3 — Symlink absolute path

**Context**: created symlinks use absolute paths tied to the current dotclaude repo location.
If the repo is moved → symlinks break.

**Decision**: **B — add a `pnpm fix-symlinks` helper**.

`scripts/fix-symlinks.ts`: scan target, detect broken (dangling) symlinks, repoint them to
the current dotclaude repo path. `package.json` script: `"fix-symlinks": "tsx scripts/fix-symlinks.ts"`.

---

### Q2-4 — settings_patch array merge policy

**Decision**: same as Q2-2 — interactive when a conflict occurs, configurable default.

Specifically for array merge when two presets patch the same key:
- First conflict → prompt:
  ```
  [conflict] settings_patch: hooks.PostToolUse — both preset-A and preset-B define entries.
  How to merge arrays? (c)oncat / (r)eplace-with-new / (k)eep-existing
  ```
- Save policy to config by key path (e.g. `hooks.PostToolUse: concat`).
- Default if not configured: `concat` (safest — no hook from any preset is lost).

**Config schema**:
```yaml
array_merge_policy:
  default: concat               # concat | replace | keep
  overrides:
    "hooks.PostToolUse": concat
```

---

### Q2-5 — Install skill folder: copy or symlink?

**Decision**: **symlink folder**.

`~/.claude/skills/coding-standards` → `/.../claudekit/skills/coding-standards/` (directory symlink).
Live-updates when `SKILL.md` is edited. `SOURCE.yaml` is visible in the target — acceptable
since Claude Code does not read unknown files.

**Impl note**: `fs-ops.ts::applySkill(src, dst)` uses `fs.symlink(src, dst, 'dir')`, not `cp -r`.

---

## Risks Phase 2

| Risk | Mitigation |
|---|---|
| Path traversal in fs-ops | Guard: dst must have prefix = target root; throw if not. |
| Circular preset extends | Detect with Set visited; throw with a clear error. |
| settings.json corruption on interruption | Backup first; write-tmp + atomic rename. |
| Symlink broken when repo is moved | Document clearly in INSTALL.md; Phase 3 `audit` will detect dangling symlinks. |
