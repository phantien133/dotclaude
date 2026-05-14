---
description: Create a pull request for the current branch using gh CLI. Reads PR settings from .claude/workflow.yaml. Pass a task slug to use plan.md as PR body, or provide a free description.
argument-hint: [task-slug | description]
allowed-tools: Bash, Read
---

# w-pr

Create a pull request for the current branch.

Reads `pr.default_branch`, `pr.draft`, `pr.template` from `.claude/workflow.yaml` if present.
Falls back to sensible defaults if config is missing.

---

## Step 1 — Load config

```bash
cat .claude/workflow.yaml 2>/dev/null
```

Extract:
- `pr.default_branch` → default `main`
- `pr.draft` → default `true`
- `pr.template` → default `null`
- `workflow.state_root` → default `.workflow`

---

## Step 2 — Resolve PR body

If `$ARGUMENTS` looks like a task slug (no spaces, matches a folder in `<state_root>/`):

```bash
STATE_ROOT=$(grep 'state_root:' .claude/workflow.yaml 2>/dev/null | awk '{print $2}' || echo ".workflow")
ls "$STATE_ROOT/$ARGUMENTS/" 2>/dev/null
```

- If `plan.md` exists: use it as PR body base.
- If `impact.md` also exists: append affected files section.
- If neither exists: treat `$ARGUMENTS` as a free description.

If `$ARGUMENTS` is a free description (has spaces or no matching folder): use it directly as PR body.

If `$ARGUMENTS` is empty: check current branch name — derive description from it, or ask:
> No description provided. Describe this PR in one sentence:

---

## Step 3 — Build PR title

Derive from:
1. First line of `plan.md` (strip `#`) — if task slug matched
2. `$ARGUMENTS` — if free description
3. Branch name — fallback: convert `feat/my-feature` → `feat: my feature`

Format as conventional commit: `type(scope): summary` where type is inferred from branch prefix
(`feat/` → `feat`, `fix/` → `fix`, `chore/` → `chore`, etc.).

---

## Step 4 — Build PR body

If `cfg.pr.template` is set, read the template file and fill sections:
- Replace `<!-- title -->` with PR title
- Replace `<!-- summary -->` with first paragraph of plan.md or $ARGUMENTS
- Replace `<!-- test-plan -->` with content of `tests.md` § Test Plan if exists, else empty checklist
- Replace `<!-- affected-files -->` with `impact.md` § Affected Files if exists

If no template: use this default structure:

```markdown
## Summary

<first paragraph of plan.md, or $ARGUMENTS>

## Changes

<impact.md § Affected Files table, or "See diff">

## Test plan

- [ ] Existing tests pass
- [ ] Manual smoke test on affected paths
<+ any items from tests.md if exists>

---
🤖 Generated with workflow skill
```

---

## Step 5 — Show preview and confirm

Display:
```
Title:  feat(auth): add email verification flow
Base:   main  →  feat/email-verification
Draft:  yes

Body preview (first 10 lines):
---
<preview>
---

Create this PR? (y/n) [y]:
```

If user types `n`: stop, show the `gh pr create` command for manual use.

---

## Step 6 — Create PR

```bash
gh pr create \
  --title "<title>" \
  --body "<body>" \
  --base <default_branch> \
  [--draft]
```

Capture the PR URL from output.

---

## Step 7 — Write pr.md

Write `<state_root>/<task-slug>/pr.md` if task slug was resolved, else skip:

```markdown
# PR — <title>

**URL:** <pr-url>
**Branch:** <current-branch> → <base>
**Created:** <date>

## Post-merge checklist

- [ ] Delete feature branch
- [ ] Verify CI passes
- [ ] Update task state: close ticket if applicable
<+ any items from workflow.docs_root if set>
```

Output: PR URL. Done.
