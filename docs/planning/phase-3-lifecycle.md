# Phase 3 — Lifecycle

> **Status**: PENDING (after Phase 2)
>
> **Prereq**: Phase 2 install pipeline complete + manifest tracking stable.

## Goal

Full lifecycle support: uninstall, upgrade, audit. A round-trip of install → modify →
uninstall leaves no leftover files.

## Scope

| Deliverable | Command |
|---|---|
| Uninstall preset | `pnpm uninstall <preset>` |
| Upgrade preset | `pnpm upgrade <preset>` |
| Audit target | `pnpm audit [--target <path>]` |

## Steps (draft — to be refined before Phase 3)

### S1 — Uninstall

- Read manifest (`~/.claude/.dotclaude-manifest.yaml` or `<cwd>/.claude/...`).
- Filter components belonging to the preset being uninstalled. Caution: components shared
  by multiple presets (manifest tracks `required_by`) → only remove if no other preset requires them.
- Revert: remove symlink/file. If a corresponding `.bak.*` exists → offer to restore it (prompt user).
- Revert `settings_patch`: deep-remove keys added by this preset (complex, needs its own strategy).
- Update manifest.

### S2 — Upgrade

- Re-resolve the preset (pull latest extends + deps).
- Diff against the old manifest → 3 operation types: ADD (new component), REMOVE (no longer in
  preset), UPDATE (component content changed).
- Apply diff operation by operation.
- Update manifest.

### S3 — Audit

- Scan all files in `~/.claude/` (or the target `.claude/`).
- Compare against manifest → list files not belonging to any installed preset.
- Output: `[UNTRACKED] ~/.claude/agents/foo.md` — owner decides what to do.
- Does not auto-delete, report only.

## Open questions Phase 3 (resolve before implementation)

- **settings_patch revert**: cannot simply deep-delete because the user may have manually
  edited the settings. Strategy: snapshot settings before install → diff → revert only the diff?
- **Upgrade conflict**: file has been locally edited → merge conflict or backup + overwrite?
- **Partial uninstall**: user wants to keep one component but uninstall the preset → add
  a `--keep <id>` flag?
