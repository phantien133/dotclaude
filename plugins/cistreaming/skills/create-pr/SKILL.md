---
description: Create pull requests for sub-repos or workspace with changes, using a user story or bug description as context.
argument-hint: <user story or bug description>
allowed-tools: Bash, Read
model: claude-sonnet-4-6
---

You are creating pull requests for a completed feature or fix. Follow these steps in order.

## Step 1: Capture context

The PR subject is provided in `$ARGUMENTS`. If empty, ask the user: "Please provide a user story or bug description. Usage: /create-pr <description>"

## Step 2: Discover target repos

Find all submodule directories (skip the workspace root itself):

```bash
find . -mindepth 2 -maxdepth 2 -name ".git" -type d | sed 's|/.git||' | sed 's|^\./||' | sort
```

For each discovered sub-repo, check for commits ahead of its remote default branch:

```bash
git -C <sub-repo> log origin/HEAD..HEAD --oneline 2>/dev/null
```

Collect sub-repos that have at least one unpushed commit as **target repos**.
If no submodules exist, use the workspace root as the single target repo.

## Step 3: For each target repo, gather diff context

```bash
git -C <sub-repo> log origin/HEAD..HEAD --oneline
git -C <sub-repo> diff origin/HEAD..HEAD --stat
git -C <sub-repo> diff origin/HEAD..HEAD
```

Use this diff along with `$ARGUMENTS` to fill in the PR body below.

## Step 4: Create the PR

For each target repo, run:

```bash
cd <sub-repo> && gh pr create \
  --title "<concise title derived from $ARGUMENTS>" \
  --body "$(cat <<'EOF'
<filled PR body — see template below>
EOF
)"
```

Fill the PR body using the template at `${CLAUDE_SKILL_DIR}/references/pr-template.md`. Read that file to get the exact structure. Every section is required; use "N/A" only when genuinely not applicable.

Infer the PR title, type checkboxes, affected areas, risk level, and test steps from the diff and `$ARGUMENTS`. Do not leave placeholder comments in the final output — replace every `<!-- ... -->` with actual content.

## Step 5: Report

Tell the user:
- Which sub-repos had PRs created, with their URLs
- Which sub-repos were skipped (no unpushed commits)
