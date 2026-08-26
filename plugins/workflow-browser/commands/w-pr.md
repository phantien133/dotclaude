---
description: Create a GitLab merge request for one repo (main workspace or a submodule) using glab CLI. Reads MR settings + per-repo default branch from .claude/workflow.yaml. Pass a task slug to use plan.md as MR body, --repo/--target to scope a submodule. Runs w-doc-gate first to enforce docs-with-code invariant.
argument-hint: [task-slug | description] [--repo <path>] [--target <branch>] [--skip-doc-gate]
allowed-tools: Bash, Read, Skill
---

# w-pr

Create a GitLab **merge request** for one repo. (Name kept as `w-pr` for command-suite
consistency; internally this is a GitLab MR via `glab`.)

Reads `repos[]`, `pr.draft`, `pr.template` from `.claude/workflow.yaml` if present.
Operates on the **main workspace** by default, or a **submodule** when `--repo` is given.
Falls back to sensible defaults if config is missing.

**Prerequisite:** `glab` is installed and authenticated (`glab auth status`).

---

## Step 1 — Load config & resolve repo

```bash
cat .claude/workflow.yaml 2>/dev/null
```

Parse `$ARGUMENTS` for flags (everything that isn't a flag is the task-slug / description):
- `--repo <path>` → which repo to operate in. Default `.` (main workspace).
- `--target <branch>` → explicit target branch. Overrides the resolved default.
- `--skip-doc-gate` → escape hatch (see Step 1b).

Resolve settings (config may be v1 or v2):
- `REPO_PATH` = `--repo` value, else `.`
- `TARGET_BRANCH` resolution order:
  1. `--target` if provided
  2. `repos[]` entry whose `path == REPO_PATH` → its `default_branch` (version 2)
  3. `pr.default_branch` (version 1 fallback)
  4. `main`
- `REMOTE` = the matching `repos[]` entry's `remote`, else `origin`
- `pr.draft` → default `true` (maps to glab `--draft`)
- `pr.template` → default `null`
- `workflow.state_root` → default `.workflow`

All git/glab commands below run inside `REPO_PATH` — use `git -C <REPO_PATH>` and run
`glab` with that directory as cwd. When `REPO_PATH == "."` this is just the project root.

---

## Step 1b — Doc gate (invariant check)

If `$ARGUMENTS` looks like a task slug AND `--skip-doc-gate` is NOT present:

**Invoke skill** `w-doc-gate <task-slug>`. The skill compares the branch diff
against `pr.default_branch` and verifies that every module with code changes
also has corresponding doc updates (module README, features/*.md, api.md,
DB docs + sub-ERD, and mandatorily the master ERD if any sub-ERD changed).

- If `w-doc-gate` exits 0: proceed to Step 2.
- If `w-doc-gate` exits non-zero: ABORT PR creation. Print the gate's violation
  report and instruct developer to return to Phase 5:
  > Doc gate blocked PR creation. Run `/w-task` to re-enter Phase 5 and persist
  > the missing docs. Re-run `/w-pr <task-slug>` once docs are committed.

If `--skip-doc-gate` is present: skip the check, but record the skip in the
PR body under § Warnings:
> ⚠️ `--skip-doc-gate` was used — docs may lag behind code in this PR.
> The doc gate exists for a reason; only use this flag in true emergencies.

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

## Verification

<verify.md check table — typecheck / lint / tests / review>
<verify.md § Browser Verify verdict, including a not-run reason when it did not run>
<acceptance.md § Verdict + the visual result, when acceptance.md exists:
 "Acceptance: PASS — <R> requirements verified, <N> fix iteration(s), visual: <result>">

## Known gaps

<open-issues.md verbatim, when it exists — this is the whole point of that file:
 the reviewer must see what survived the fix loop before approving.
 Omit this section entirely when there is no open-issues.md.>

---
🤖 Generated with workflow skill
```

A not-run check is never omitted from the body. "Browser verify: not run (MCP held by
another session — skipped by operator)" is information a reviewer needs; silence reads
as a pass.

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
Repo:     <REPO_PATH>   (main workspace | submodule)
Title:    feat(auth): add email verification flow
Target:   <TARGET_BRANCH>  ←  feat/email-verification
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

Run inside `REPO_PATH` (so `glab` targets the correct repo for a submodule):

```bash
( cd <REPO_PATH> && glab mr create \
  --title "<title>" \
  --description "<body>" \
  --target-branch <TARGET_BRANCH> \
  --source-branch "$(git -C <REPO_PATH> branch --show-current)" \
  --remove-source-branch \
  --squash-before-merge \
  [--draft] \
  --yes )
```

Notes:
- For a submodule, push its branch first if needed
  (`git -C <REPO_PATH> push -u <REMOTE> "$(git -C <REPO_PATH> branch --show-current)"`).
- `--remove-source-branch` and `--squash-before-merge` set the MR options; the project's
  protected-branch / approval rules still apply at merge time.
- If `glab` is not installed or unauthenticated, print the install / auth hint and stop —
  do not silently fall back to `gh`.

Capture the MR URL from output.

---

## Step 7 — Record pr.md

If a task slug was resolved, **append** a per-repo MR block to
`<state_root>/<task-slug>/pr.md` (append, not overwrite — Phase 6 may call `w-pr`
once per repo, and each block must survive):

```markdown
## MR (<REPO_PATH>) — <title>

**URL:** <mr-url>
**Repo:** <REPO_PATH>  (main workspace | submodule)
**Branch:** <current-branch> → <TARGET_BRANCH>
**Created:** <date>

- [ ] Source branch removed (glab `--remove-source-branch`)
- [ ] Pipeline passes
```

If no task slug: skip the file write.

Output the MR URL. Done. (When driven by w-task Phase 6, the workflow records the
URL in `state.yaml.prs[]` and marks the task complete — this command does not
update workflow phase/status itself.)
