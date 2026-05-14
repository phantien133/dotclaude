---
description: Create a GitLab merge request for the current branch using glab CLI. Reads MR settings from .claude/workflow.yaml. Pass a task slug to use plan.md as MR body, or provide a free description.
argument-hint: [task-slug | description]
allowed-tools: Bash, Read
---

# w-pr

Create a GitLab **merge request** for the current branch. (Name kept as `w-pr` for command-suite
consistency; internally this is a GitLab MR via `glab`.)

Reads `pr.default_branch`, `pr.draft`, `pr.template` from `.claude/workflow.yaml` if present.
Falls back to sensible defaults if config is missing.

**Prerequisite:** `glab` is installed and authenticated (`glab auth status`).

---

## Step 1 — Load config

```bash
cat .claude/workflow.yaml 2>/dev/null
```

Extract:
- `pr.default_branch` → default `main`
- `pr.draft` → default `true` (maps to glab `--draft`)
- `pr.template` → default `null`
- `workflow.state_root` → default `.workflow`

---

## Step 2 — Resolve MR body

If `$ARGUMENTS` looks like a task slug (no spaces, matches a folder in `<state_root>/`):

```bash
STATE_ROOT=$(grep 'state_root:' .claude/workflow.yaml 2>/dev/null | awk '{print $2}' || echo ".workflow")
ls "$STATE_ROOT/$ARGUMENTS/" 2>/dev/null
```

- If `plan.md` exists: use it as MR body base.
- If `impact.md` also exists: append affected files section.
- If neither exists: treat `$ARGUMENTS` as a free description.

If `$ARGUMENTS` is a free description (has spaces or no matching folder): use it directly as MR body.

If `$ARGUMENTS` is empty: check current branch name — derive description from it, or ask:
> No description provided. Describe this MR in one sentence:

---

## Step 3 — Build MR title

Derive from:
1. First line of `plan.md` (strip `#`) — if task slug matched
2. `$ARGUMENTS` — if free description
3. Branch name — fallback: convert `feat/my-feature` → `feat: my feature`

Format as conventional commit: `type(scope): summary` where type is inferred from branch prefix
(`feat/` → `feat`, `fix/` → `fix`, `chore/` → `chore`, etc.).

GitLab convention: if `pr.draft` is true, glab uses the `--draft` flag rather than a `Draft:`
title prefix — do **not** also prefix the title.

---

## Step 4 — Build MR body

If `cfg.pr.template` is set, read the template file and fill sections:
- Replace `<!-- title -->` with MR title
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

If the task folder contains a linked issue ID (from intake), append a GitLab close keyword on
its own line so the MR auto-closes on merge:

```
Closes #<iid>
```

Use the project-relative issue IID (e.g. `#42`), not the full URL.

---

## Step 5 — Show preview and confirm

Display:
```
Title:    feat(auth): add email verification flow
Target:   main  ←  feat/email-verification
Draft:    yes
Project:  <namespace>/<project>   (from glab repo view)

Body preview (first 10 lines):
---
<preview>
---

Create this MR? (y/n) [y]:
```

To resolve `Project`, run `glab repo view --output json 2>/dev/null | jq -r .path_with_namespace`
(or fall back to parsing `git remote get-url origin`).

If user types `n`: stop, show the `glab mr create` command for manual use.

---

## Step 6 — Create MR

```bash
glab mr create \
  --title "<title>" \
  --description "<body>" \
  --target-branch <default_branch> \
  --source-branch "$(git branch --show-current)" \
  --remove-source-branch \
  --squash-before-merge \
  [--draft] \
  --yes
```

Notes:
- `--remove-source-branch` and `--squash-before-merge` set the MR options; the project's
  protected-branch / approval rules still apply at merge time.
- If `glab` is not installed or unauthenticated, print the install / auth hint and stop —
  do not silently fall back to `gh`.

Capture the MR URL from output.

---

## Step 7 — Write pr.md

Write `<state_root>/<task-slug>/pr.md` if task slug was resolved, else skip:

```markdown
# MR — <title>

**URL:** <mr-url>
**Branch:** <current-branch> → <target>
**Created:** <date>

## Post-merge checklist

- [ ] Source branch removed (glab `--remove-source-branch`)
- [ ] Verify pipeline passes
- [ ] Update task state: close linked issue if not auto-closed
<+ any items from workflow.docs_root if set>
```

Output: MR URL. Done.
