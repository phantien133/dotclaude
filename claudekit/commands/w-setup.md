---
description: One-time setup wizard that creates .claude/workflow.yaml — the project config consumed by w-task, w-fix, and all workflow skills. Spawns code-explorer to survey project structure before asking questions, so suggestions are accurate. Run once per project before using any workflow skill.
argument-hint: [--reset]
allowed-tools: Bash, Read, Write, Agent
---

# w-setup

Interactive wizard that writes `.claude/workflow.yaml`.
All workflow skills (`w-task`, `w-fix`, `w-status`, etc.) read this file.

**First run:** surveys the project, then walks through setup interactively.
**`--reset`:** shows existing config and reconfigures selected sections.

---

## Step 0 — Check existing config

```bash
cat .claude/workflow.yaml 2>/dev/null
```

- **File missing + no `--reset`:** proceed to Step 1.
- **File exists + no `--reset`:** display current config and say:
  > Config already exists. Run `/w-setup --reset` to reconfigure, or `/w-task <title>` to start a task.
  Stop here.
- **`--reset` flag:** display current config, proceed to Step 1 (existing values shown as defaults).

---

## Step 1 — Project Survey (code-explorer)

Before asking any questions, spawn the `code-explorer` agent to survey the project.
Use its findings to pre-fill all suggestions in Steps 2–7.

**Agent brief:**

> Survey this project's configuration and structure to inform a workflow setup wizard.
> Focus on the following — do NOT analyse business logic or feature code:
>
> 1. **Root layout**: list top-level dirs and files. Identify if this is a monorepo
>    (multiple `package.json`/`go.mod`/`pyproject.toml`, workspaces config, etc.).
>    List all source root directories (e.g. `src/`, `packages/`, `apps/`, `services/`).
>
> 2. **Language & runtime**: detect primary language(s) from config files
>    (`package.json` → Node/TS, `pyproject.toml`/`setup.py` → Python,
>    `go.mod` → Go, `Cargo.toml` → Rust, `pom.xml`/`build.gradle` → JVM).
>
> 3. **Test setup**: find test config files (`jest.config.*`, `vitest.config.*`,
>    `pytest.ini`, `pyproject.toml [tool.pytest]`, `go.mod` → `go test`,
>    `Cargo.toml` → `cargo test`). Read `package.json scripts` if present.
>    Determine the exact test command to run.
>
> 4. **Typecheck setup**: look for `tsconfig.json` (→ `npx tsc --noEmit`),
>    `mypy.ini`/`pyproject.toml [tool.mypy]` (→ `mypy .`), or equivalent.
>
> 5. **Lint setup**: look for `.eslintrc*`, `eslint.config.*` (→ `npx eslint .`),
>    `ruff.toml`/`pyproject.toml [tool.ruff]` (→ `ruff check .`),
>    `.golangci.yml` (→ `golangci-lint run`), `clippy` (→ `cargo clippy`).
>
> 6. **CI scripts**: read `.github/workflows/*.yml` (first 2 files only).
>    Extract the exact test, lint, and typecheck commands used in CI —
>    these are the most reliable source of truth.
>
> 7. **Docs structure**: check if `docs/`, `documentation/`, or `wiki/` exists
>    and what format it uses.
>
> 8. **Git**: run `git remote get-url origin` and `git branch -r | head -5`
>    to identify the remote host and default branch.
>
> Output a structured report with these exact sections:
> - **Monorepo**: yes/no + workspace dirs if yes
> - **Language(s)**: list
> - **Source dirs**: list of paths
> - **Test command**: exact string, or "none detected"
> - **Typecheck command**: exact string, or "none detected"
> - **Lint command**: exact string, or "none detected"
> - **CI commands**: test / typecheck / lint extracted from CI, or "not found"
> - **Docs root**: path, or "none"
> - **Git remote host**: github / gitlab / bitbucket / other
> - **Default branch**: main / master / other
> - **Notes**: anything unusual

Store the agent's full report as `survey` for use in all subsequent steps.

---

## Step 2 — Issue tracker

Use `survey.git_remote_host` to suggest a default:
- `github.com` → suggest `github`
- other → suggest `none`

Display survey finding:
```
Detected git remote: <host> → suggesting <tracker>
```

Ask:
```
Which issue tracker does this project use?
  1) GitHub Issues  (fetch via gh CLI)
  2) Plane          (pm.*.* URL)
  3) Jira           (*.atlassian.net)
  4) Linear         (linear.app)
  5) None           (always use free text)

Enter number [<suggested>]:
```

---

## Step 3 — Issue tracker details

**github:** No further questions.

**plane:**
```
Plane workspace URL (e.g. https://pm.example.com): ___
Workspace slug: ___
Project identifier prefix (e.g. MYPROJ): ___
Are Plane MCP tools configured in this Claude Code session? (y/n) [n]: ___
```

**jira:**
```
Jira base URL (e.g. https://company.atlassian.net): ___
Project key (e.g. PROJ): ___
API token env var name [JIRA_TOKEN]: ___
```

**linear:**
```
Linear workspace URL: ___
Team ID or key: ___
API token env var name [LINEAR_TOKEN]: ___
```

**none:** skip to Step 4.

---

## Step 4 — Workflow state root

```
Where should workflow state files (<state_root>/<task-slug>/state.yaml) be stored?
  Default: .workflow

Press Enter to accept, or type a path: ___
```

---

## Step 5 — Docs root

Use `survey.docs_root` as the suggestion:

- If survey found a docs dir:
  ```
  Detected: <path>/ — use this as docs root for feature records? (Enter to accept, or type path, or blank to skip): ___
  ```
- If not found:
  ```
  Docs folder for persistent feature records? (blank to skip Phase 5 in w-task): ___
  ```

---

## Step 6 — Commands

Show survey findings. Prefer CI-extracted commands over detected — mark clearly:

```
Project survey:
  Language(s):  <languages>
  Monorepo:     <yes — workspaces: ... | no>
  Source dirs:  <list>

Suggested commands  ([CI] = extracted from CI pipeline, most reliable):
  test:       <command>   [CI] / [detected] / [none detected]
  typecheck:  <command>   [CI] / [detected] / [none detected]
  lint:       <command>   [CI] / [detected] / [none detected]

Press Enter to accept each, or type an override (blank = skip that check):
test       [<value>]: ___
typecheck  [<value>]: ___
lint       [<value>]: ___
```

---

## Step 7 — PR settings

Use `survey.default_branch` as default:

```
Default branch for PRs [<survey.default_branch or "main">]: ___
Open PRs as drafts? (y/n) [y]: ___
Path to PR body template file (optional, Enter to skip): ___
```

---

## Step 8 — Write config

Write `.claude/workflow.yaml`:

```yaml
# Generated by /w-setup — edit manually if needed
# Consumed by: w-task, w-fix, w-status, w-reset, w-checkpoint, w-pr
version: 1

issue_tracker:
  type: <github|plane|jira|linear|none>
  # tracker-specific fields only when type != github/none:
  url: <url>
  workspace: <workspace>
  project: <project>
  mcp_available: <true|false>      # plane only

workflow:
  state_root: <path>               # default: .workflow
  docs_root: <path or null>        # null = skip Phase 5 in w-task

project:
  test_command: <command or null>
  typecheck_command: <command or null>
  lint_command: <command or null>
  src_dirs: <list from survey, or []>

pr:
  default_branch: <branch>
  draft: <true|false>
  template: <path or null>
```

Add `.workflow/` to `.gitignore` automatically if not already present:

```bash
grep -q "^\.workflow" .gitignore 2>/dev/null || echo ".workflow/" >> .gitignore
```

---

## Step 9 — Summary

```
✓ .claude/workflow.yaml written

Survey applied:
  Language:     <language(s)>
  Source dirs:  <list>
  Commands:     from CI / detected / manual

Config written:
  Issue tracker:  <type>
  State root:     .workflow/  (added to .gitignore)
  Docs root:      <path or "skipped">
  Test:           <command or "none">
  Typecheck:      <command or "none">
  Lint:           <command or "none">
  PR branch:      <branch> (<draft/open>)

Next steps:
  /w-task <title or issue URL>   — start a feature task
  /w-fix  <title or issue URL>   — fix a bug or small change
  /w-status                      — check current task state
```
