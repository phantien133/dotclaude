# CLAUDE.md — dotclaude (Hilab)

Hilab company repo for managing Claude Code config (claudekit core + preset manifests + TS
installer). When opening Claude Code in this folder, the information below is the primary context.

## Owner & Communication

- Owner: Hilab AI Kit team (tienpq@hilab.asia).
- Communication: **English** for all responses, code, file names, identifiers, and commit messages.
- Keep answers concise and actionable — no need to explain basics.

## Architecture

```
dotclaude/
├── CLAUDE.md / README.md / dependencies.yaml
├── package.json + tsconfig.json + vitest.config.ts + pnpm-lock.yaml
│
├── claudekit/                      # Core kit, type-first
│   ├── agents/<n>.md + <n>.source.yaml
│   ├── skills/<n>/SKILL.md + SOURCE.yaml
│   ├── {commands,hooks,rules}/
│   ├── private/                    # GITIGNORED
│   └── private.example/            # TRACKED skeleton
│
├── presets/                        # Pure manifest
│   ├── {core,framework,purpose}/<name>/preset.yaml + README.md [+ scripts/ hooks/]
│   ├── private/ + private.example/
│   └── schema/*.schema.json        # Generated from zod
│
├── plugins/                        # Build artifacts for marketplace
├── marketplace.json                # Local marketplace index
├── upstream/                       # Submodules — sync_source + docs
└── scripts/                        # 100% TS via tsx
    ├── install.ts                  # Entry: validate | list | user | project | uninstall | upgrade | audit
    ├── sync-from-upstream.ts
    ├── generate-schemas.ts
    ├── build-plugin.ts + publish-plugin.ts
    ├── init-private.ts + clean-backups.ts
    └── lib/{schema,yaml,paths,sidecar,preset,resolver,fs-ops,manifest,settings-merge,lifecycle,marketplace,plugin-build,upstream,logger}.ts
```

See `docs/architecture.md` for design decisions (CQs), resolver flow, and plugin build flow.

---

## Common Workflows

### New machine setup

```bash
git clone --recursive ssh://git@gitlab.hilab.cloud:2424/hilabaikit/dotclaude.git
cd dotclaude
pnpm install
pnpm typecheck && pnpm test
# Then: pnpm init-private + restore private content from cloud sync
```

### Vendor a new component from upstream

Use the `dotclaude-component-picker` skill — it covers the full 8-step pipeline
(browse → evaluate → cross-reference scan → vendor → sidecar → preset → install → verify).

Quick manual path if needed:

```bash
# Copy file/folder
cp upstream/<alias>/<type>/<name>.md claudekit/<type>/<name>.md

# Get pin
git -C upstream/<alias> rev-parse HEAD

# Create sidecar, then verify
pnpm typecheck && pnpm test
```

See `docs/PROVENANCE.md` for sidecar schema.

### Create a new preset

```bash
KIND=core; NAME=my-baseline
mkdir -p presets/$KIND/$NAME
cp presets/core/developer/preset.yaml presets/$KIND/$NAME/preset.yaml
cp presets/core/developer/README.md   presets/$KIND/$NAME/README.md
$EDITOR presets/$KIND/$NAME/preset.yaml
pnpm validate $NAME --kind $KIND
```

See `docs/PRESETS.md` for schema + authoring guide.

### Sync upstream

```bash
git submodule update --remote upstream/everything-claude-code
git -C upstream/everything-claude-code rev-parse HEAD  # update dependencies.yaml pinned_commit
pnpm sync agents/code-reviewer                         # diff per-component
# Manually merge, update sidecar.source.commit if adopting
```

### Regenerate JSON Schema

```bash
pnpm schema:generate   # idempotent, commit result to git
```

After editing `scripts/lib/schema.ts`, run this to keep JSON Schema in sync.

### Build and publish a plugin

```bash
pnpm build-plugin personal-baseline --clean
pnpm publish-plugin personal-baseline --clean
# Then copy plugins/<name>/ to hilabaikit/claudekit-marketplace repo and push
```

Plugin output: `plugins/<preset-name>/` with `.claude-plugin/plugin.json` + component files.
No sidecar files are included in the bundle. `agents` and `hooks` are auto-discovered by
Claude Code — never declared in plugin.json.

---

## Planning

- Planning documents go in `docs/plan/<name>.md`.
- `docs/plan/` is gitignored — plans are local-only, never committed to the repo.
- When starting a multi-step task, create a plan file in `docs/plan/` and keep it updated.

---

## Code Editing Principles

1. **Schema-first**: changing data shape → edit zod schema first, regen JSON Schema,
   then update consumers. Tests must pass.
2. **Sidecar sync**: editing a component in `claudekit/` → set `modified: true` +
   update `modifications:` text. Don't forget.
3. **Strict TS**: `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` in
   tsconfig — code must handle `undefined` explicitly. No arbitrary casts.
4. **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`. English headers.
5. **Commit small**: 1 commit per change — easier to revert.
6. **Verify before destructive ops**: before `git rm` / `rm -rf` / submodule deinit,
   confirm with owner — do not act unilaterally.

---

## Common Pitfalls

- **`pnpm list` vs `pnpm run list`**: pnpm built-in `list` takes priority. Use
  `pnpm run list` to call the preset list script.
- **`pnpm install` vs `pnpm install:project`**: `pnpm install <name>` is intercepted
  by pnpm as an npm install command. Use `pnpm install:project <preset>` or
  `pnpm install:user <preset>` to invoke the dotclaude installer.
- **Date in YAML**: js-yaml by default parses `2026-05-08` as a Date object. This repo uses
  `lib/yaml.ts` with `CORE_SCHEMA` to keep it as a string. Do not `import yaml from 'js-yaml'`
  directly — use `import { loadYaml, dumpYaml } from './lib/yaml.ts'`.
- **Sidecar path**: file-component sidecar = `<name>.source.yaml` in same dir;
  folder-component = `SOURCE.yaml` INSIDE the folder. Installer must EXCLUDE
  `SOURCE.yaml` when copying a folder to a target.

---

## References

| Doc | Contents |
|---|---|
| `docs/architecture.md` | Design decisions (CQs), resolver + plugin flows |
| `docs/PROVENANCE.md` | Sidecar schema + sync workflow |
| `docs/PRESETS.md` | Preset schema + authoring guide |
| `docs/PRIVATE.md` | private/ convention + bootstrap |
| `docs/INSTALL.md` | Installer usage |
| `dependencies.yaml` | Upstream sources (4 submodules) + pinned commits |
