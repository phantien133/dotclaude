# presets/private/ — Private presets

`presets/private/` mirrors the public structure of `presets/`. This folder is
**gitignored** at the repo root (`.gitignore` rule `/presets/private/`).

```
presets/private/
├── core/
│   └── <my-private-baseline>.yaml
│   └── <my-private-baseline>.md
├── framework/
│   └── <internal-stack>.yaml
└── purpose/
```

## When to create a private preset?

- **Internal stack**: an internal project with specific tooling (e.g. Next.js + an
  internal logging lib + a private auth dashboard).
- **Per-project**: a project with very specific config that warrants a dedicated preset
  (e.g. `presets/private/purpose/projectA-onboarding.yaml`).
- **Sensitive**: a preset referencing private components, internal MCP servers, or
  internal markdown notes.

## Schema

Same schema as public presets (`presets/schema/preset.schema.json`). YAML header:

```yaml
# yaml-language-server: $schema=../../schema/preset.schema.json
```

Note the path `../../schema/...` if the private preset is nested one level deeper.

## Resolver behavior

Mirrors the component lookup logic:

- `pnpm install:user my-private-baseline --kind core` → installer searches
  `presets/core/my-private-baseline.yaml` (public) first, falls back to
  `presets/private/core/my-private-baseline.yaml`.
- Preset names must be unique by (kind + name) — public and private share the same
  namespace for `extends:`.

## Bootstrap on a new machine

Same as `claudekit/private/`: copy content from your personal source. See
`docs/PRIVATE.md`.
