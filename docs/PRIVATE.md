# PRIVATE — Convention & Bootstrap

## Purpose

`private/` holds owner-private overlays — content that should NOT be public:

- Company-specific agents/skills (internal workflows, project names, non-public URLs).
- Personal experiments not yet polished (under trial, will be promoted or dropped).
- Unstable forks of upstream components.
- Presets for internal projects with specific tooling.

## Layout (CQ-4a/b)

```
claudekit/private/                    # GITIGNORED
├── agents/<name>.md + <name>.source.yaml
├── skills/<name>/SKILL.md + SOURCE.yaml
├── commands/
├── hooks/
└── rules/

presets/private/                       # GITIGNORED
├── core/<name>.yaml + <name>.md
├── framework/
└── purpose/

claudekit/private.example/             # TRACKED skeleton
├── README.md (guide)
└── {agents,skills,commands,hooks,rules}/.gitkeep

presets/private.example/               # TRACKED skeleton
├── README.md
└── {core,framework,purpose}/.gitkeep
```

## .gitignore rules (already set)

```gitignore
/claudekit/private/
/presets/private/
/plugins/private/
```

Absolute rules (leading `/`) — only ignore the folder at repo root, no effect on nested
folders named `private` elsewhere.

## Resolver behavior

When a preset references a flat component ID (`code-reviewer`):

1. Search `claudekit/<type>/<id>` (public) first.
2. Fallback to `claudekit/private/<type>/<id>` if not found in public.
3. Throw if both miss.

→ A public component with the SAME NAME as a private one wins. To override, give the
private component a different name and update the preset reference.

Same logic for presets: `presets/<kind>/<name>.yaml` public first, private fallback.

## Bootstrap on a new machine (CQ-4d)

The dotclaude repo does **not manage distribution** of `private/`. The owner handles it via:

- iCloud / Dropbox / Google Drive sync folder.
- 1Password Secure Note with attachments.
- USB drive (for machines without cloud access).
- Separate private repo (`dotclaude-private`) — not recommended by default as it adds setup complexity.

### Bootstrap flow

```bash
# 1. Clone dotclaude
git clone --recursive ssh://git@gitlab.hilab.cloud:2424/hilabaikit/dotclaude.git
cd dotclaude

# 2. Init private skeleton from private.example/
pnpm init-private    # to be implemented in Phase 2 — copies private.example/ → private/

# 3. Restore private content from personal source
cp -r ~/Documents/dotclaude-backup/claudekit/private/* claudekit/private/
cp -r ~/Documents/dotclaude-backup/presets/private/*   presets/private/

# 4. Verify
pnpm typecheck
pnpm run list                    # check that private presets appear
pnpm validate <my-private-preset> --kind core
```

### Backup recommendation

After each addition or edit to private content:

```bash
# General backup
rsync -av --delete claudekit/private/ ~/Documents/dotclaude-backup/claudekit/private/
rsync -av --delete presets/private/   ~/Documents/dotclaude-backup/presets/private/

# Or use a cloud sync folder as the target
```

## Convention for private content

- Identical format to public (same frontmatter agent/skill convention).
- Vendored from upstream and modified → still requires a sidecar (for tracking and future sync).
- Naming can be more relaxed than public, but avoid duplicating public names (resolver is public-first).

## When to promote private → public?

- Component is stable and generic (no longer company-specific).
- Ready to share and accept feedback.
- Content has NO remaining secret or internal references.

```bash
# Move file
git mv claudekit/private/agents/foo.md claudekit/agents/foo.md
git mv claudekit/private/agents/foo.source.yaml claudekit/agents/foo.source.yaml

# Update sidecar — strip any company-specific paths in source if present

# Commit
git commit -m "feat: promote agent foo from private to public"
```
