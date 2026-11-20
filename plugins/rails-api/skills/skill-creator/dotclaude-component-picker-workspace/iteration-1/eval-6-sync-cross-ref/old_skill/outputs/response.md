# Sync: coding-standards from ECC

Following the **Upgrade an existing component** workflow from the skill.

## Step 1 — Browse

```bash
git submodule update --remote upstream/everything-claude-code
```

Check current state:
```bash
ls upstream/everything-claude-code/skills/coding-standards/
ls claudekit/skills/coding-standards/
```

`coding-standards` exists in `claudekit/` — this is an upgrade, not a fresh vendor.

## Step 2 — Evaluate (Upgrade path)

Run the sync command to see what changed:

```bash
pnpm sync skills/coding-standards
```

This shows a diff between the pinned commit in `claudekit/skills/coding-standards/SOURCE.yaml` and upstream HEAD.

Read the upstream SKILL.md to understand what changed:
- Check if any new sections were added
- Note any external dependency changes

## Upgrade decision

If the diff looks safe:
1. Manually merge the desired changes into `claudekit/skills/coding-standards/SKILL.md`
2. Update `SOURCE.yaml`:
   - Bump `source.commit` to the new upstream HEAD
   - Set `modified: true` if the local copy diverged from upstream
   - Update `modifications:` to describe any local customizations kept

## Verify

```bash
pnpm typecheck && pnpm test
```

## Commit

```bash
git add claudekit/skills/coding-standards/
git commit -m "chore(skills): sync coding-standards from ECC upstream"
```

---

**Note on cross-references:** The old skill does not include a systematic step for checking whether new cross-references appeared in the upstream diff. The user asked specifically about this — the old skill's guidance is generic: "note [internal dependencies]; they go in `dependencies.required` or `dependencies.optional`". There is no grep scan, no decision matrix, and no recursive pick workflow. The operator would need to manually eyeball the diff for any new skill/agent mentions.
