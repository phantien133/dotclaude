# claudekit/private/ — Private overlays for personal/company-specific kit

`claudekit/private/` mirrors the public structure of `claudekit/`. This folder is
**gitignored** at the repo root (`.gitignore` rule `/claudekit/private/`).

```
claudekit/private/
├── agents/
│   └── <my-private-agent>.md
│   └── <my-private-agent>.source.yaml   # if vendored from upstream
├── skills/
│   └── <my-private-skill>/
│       ├── SKILL.md
│       └── SOURCE.yaml
├── commands/
├── hooks/
└── rules/
```

## When to place a component in `private/`?

- **Company-specific**: agents/skills containing internal workflows, company project names.
- **Secrets-adjacent**: prompts referencing internal system names, non-public URLs, usernames, etc.
- **Personal experiments** not ready to share: agents under trial.
- **Unpolished forks**: edited versions under test, to be promoted to public later.

## Resolver behavior

When a preset references a flat component ID (`code-reviewer`), the installer:

1. Searches `claudekit/<type>/<id>` (public) first.
2. Falls back to `claudekit/private/<type>/<id>` if not found.
3. Throws if neither is found.

→ You cannot override a public component by placing one with the same name in private;
private only kicks in when the public lookup misses. To use a private override, give it a
different name and update the preset reference.

## Bootstrap on a new machine

The dotclaude repo **does not manage distribution of `private/`**. When cloning on a
new machine:

1. Init skeleton: `pnpm init-private` (copies `claudekit/private.example/` →
   `claudekit/private/` and similarly for `presets/`).
2. Copy private content from your personal source (iCloud / Dropbox / 1Password / USB
   drive). See `docs/PRIVATE.md` for the convention the owner uses.

## Component format in private

Identical to public — same frontmatter agent/skill convention. If a component is
vendored from upstream with modifications, a sidecar `<name>.source.yaml` or
`SOURCE.yaml` (for skill folders) is still required to track provenance.
