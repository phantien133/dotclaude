# Phase 4 — Marketplace + Plugin

> **Status**: PENDING (after Phase 3)
>
> **Prereq**: Phase 3 lifecycle stable + Claude Code plugin API docs verified.

## Goal

Publish 1–2 initial presets to a self-hosted marketplace. Other users (or the owner on a
new machine) can install them via the official Claude Code plugin install flow.

## Scope

| Deliverable | Detail |
|---|---|
| Plugin build script | `scripts/build-plugin.ts` |
| Plugin manifest format | `plugins/<preset>/plugin.json` |
| Self-hosted marketplace repo | `phantien133/claudekit-marketplace` (separate repo) |
| Publish workflow | Build → push artifact to marketplace repo |

## Steps (draft — to be refined before Phase 4)

### S1 — Verify the Claude plugin model

Read the latest Anthropic docs on:
- Plugin manifest format (`plugin.json` fields, version, entry points).
- Marketplace index format (single `marketplace.json` or one folder per plugin?).
- Install flow: `/plugin marketplace add <url>` → `/plugin install <name>`.

Source: `upstream/anthropic-cookbook` + Claude Code official docs.

**Blocker**: if the plugin API is not yet public/stable → narrow Phase 4 scope.

### S2 — `scripts/build-plugin.ts`

- Input: preset name.
- Resolver runs the same way as install (pulls extends, deps, all components).
- Output: `plugins/<preset>/`
  - `plugin.json` — auto-generated from preset metadata (name, version, description, tags,
    component list).
  - Components bundled inside (no symlinks — plugin must be self-contained).
  - `SOURCE.yaml` excluded from the bundle.

### S3 — Marketplace repo

- Create repo `phantien133/claudekit-marketplace` (public).
- Layout:
  ```
  marketplace.json         # index: list of all plugins + version + url
  plugins/
    personal-baseline/
      plugin.json
      agents/...
      skills/...
  ```
- Workflow: `pnpm run publish <preset>` → build + copy to marketplace repo + commit +
  push.

### S4 — Test round-trip

From another machine (or fresh profile):
```bash
# Assuming Claude Code supports:
/plugin marketplace add https://github.com/phantien133/claudekit-marketplace
/plugin install personal-baseline
```
Verify files are present at `~/.claude/`.

## Open questions Phase 4

- **Actual plugin format**: has Anthropic published a spec? If not → narrow Phase 4 scope
  to "build a bundle zip + manual install" instead of a marketplace.
- **Versioning**: when a preset is updated (version bump), how does the marketplace update?
  CI auto-push or manual?
- **License**: components from ECC are MIT → can be bundled. But license info needs to be
  recorded in `plugin.json`.
