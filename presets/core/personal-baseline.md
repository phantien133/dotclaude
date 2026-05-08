# personal-baseline

> Kind: `core` · Version: `0.1.0` · Tags: `baseline`, `cross-stack`

Cross-stack baseline preset applicable to any project. This is the first preset the
owner installs when setting up a new machine or initialising `~/.claude/` for the first
time.

## When to use

- Set up a user-level baseline on a new machine: `pnpm install:user personal-baseline`.
- Combine with a framework preset (e.g. `nextjs-app`) when entering a project: framework
  presets typically `extends: [personal-baseline]` so the baseline components don't need
  to be listed again.

## Components installed

Directly via `components`:

- `agents/code-reviewer` — in-depth code review agent (CRITICAL/HIGH/MEDIUM/LOW
  taxonomy, confidence-based filtering).

Auto-included via the dependency resolver (read from
`claudekit/agents/code-reviewer.source.yaml`):

- `skills/coding-standards` — required dependency of `code-reviewer`. Provides baseline
  conventions (naming, immutability, code-quality review).

## Why these two?

`code-reviewer` needs a baseline rule set to compare against during reviews —
`coding-standards` is a context-efficient skill that belongs in the user-level kit from
day one.

## Notes

- When a framework preset (e.g. Next.js) adds overlapping components, the dependency
  resolver deduplicates by `<type>:<id>` — no component is installed twice.
- If you want to exclude `coding-standards` (preferring a different skill), there is
  currently no `exclude` mechanism in preset extends (CQ-3b, Phase 1 appends only).
  Workaround: write a replacement baseline preset that does not extend this one.
