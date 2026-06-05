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

## Step 0 — Check existing config & version

```bash
cat .claude/workflow.yaml 2>/dev/null
```

This wizard writes config schema **`CURRENT_VERSION = 2`**. Read the existing
file's `version:` field (treat a missing `version:` as `1`) and branch:

- **File missing + no `--reset`:** proceed to Step 1 (fresh setup).

- **File exists, `version == 2`, no `--reset`:** display current config and say:
  > Config already exists (version 2). Run `/w-setup --reset` to reconfigure, or `/w-task <title>` to start a task.
  Stop here.

- **File exists, `version < 2` (or no `version:`), no `--reset`:** an older config
  was detected → **offer auto-migration** (do NOT silently overwrite, do NOT force a
  full re-interview). See **Step 0a — Migrate** below.

- **File exists, `version > 2`:** the config is newer than this wizard. Say:
  > ⚠️ workflow.yaml is version `<N>`, but this `/w-setup` only understands version 2.
  > Update the workflow plugin before reconfiguring, or edit the file by hand.
  Stop here — do not rewrite.

- **`--reset` flag (any version):** display current config, proceed to Step 1
  (existing values shown as defaults). A `--reset` run also upgrades the file to
  version 2 on write.

---

## Step 0a — Migrate older config (auto, with confirm)

*Only when an existing file has `version < 2`.*

The breaking addition in v2 is the top-level **`repos:`** list (per-repo default
branch — see Step 7a). Migration preserves every existing value and only ADDS the
new fields. No re-interview.

1. **Detect repos / submodules** of the project:
   ```bash
   git submodule status 2>/dev/null            # lists submodule paths, if any
   cat .gitmodules 2>/dev/null | grep 'path =' # fallback enumeration
   ```
   For each repo (the main workspace `.` plus every submodule path), resolve its
   default branch:
   ```bash
   git -C <path> symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##'
   ```
   - Main workspace `.` → default branch = old `pr.default_branch` if set, else the
     `symbolic-ref` result, else `main`.
   - Each submodule → its own `symbolic-ref` result. If it can't be resolved, leave
     it blank and flag it for the developer to fill in the confirm card.

2. **Show the migration card** — only the additions, existing values are kept verbatim:
   ```
   Detected workflow.yaml version: <N> (current: 2)

   Will ADD:
     + version: 2
     + repos:
         - path: "."         default_branch: <derived>   remote: origin
         - path: apps/api    default_branch: <derived>   remote: origin   (submodule)
       (2 git submodule(s) detected; main workspace + submodules listed above)

   All existing settings (issue_tracker, workflow.*, project.*, pr.*) are preserved.
   Any default_branch shown as "<?>" could not be auto-detected — edit before accepting.

   Migrate now? [Y]es / [e]dit a branch / [n]o (keep as-is): ___
   ```

3. **Y / Enter** → write the upgraded file (Step 8) with `version: 2` + the derived
   `repos:` list, every other field copied unchanged. Print a one-line confirmation
   and stop (no need to walk Steps 1–7).
   **e** → ask which repo's `default_branch` to change, set it, re-show the card.
   **n** → leave the file untouched, stop.

If the project has **no** submodules, `repos:` is a single entry
`[{path: ".", default_branch: <derived>, remote: origin}]` — migration is still
applied so the file reaches version 2 and gains the explicit `repos:` list.

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
> 7. **Docs structure**: check if `docs/`, `documentation/`, `wiki/`,
>    `streaming-docs/`, or `*-docs/` exists. For each candidate, probe for the
>    **streaming-docs convention** — does it have a `documents/` AND `workflow/`
>    subdir side-by-side? If yes, classify as `streaming-docs-convention` and
>    return the parent (the `<docs_root>`). If only `documents/` exists, still
>    classify as `streaming-docs-convention` (workflow/ will be created). If
>    neither, classify as `flat-layout`. Also probe for these sub-paths and
>    report which exist:
>    - `<docs_root>/documents/modules/`
>    - `<docs_root>/documents/database/`
>    - `<docs_root>/documents/database/diagrams/`
>    - `<docs_root>/documents/database/diagrams/00-database-overview-erd.puml`
>    - `<docs_root>/documents/overview/open-questions.md`
>    - `<docs_root>/documents/overview/architecture-overview.md`
>    - `<docs_root>/workflow/`
>
> 8. **Git**: run `git remote get-url origin` and `git branch -r | head -5`
>    to identify the remote host and default branch. Also enumerate submodules and
>    each repo's own default branch — a superproject may mix `main` and `master`:
>    ```bash
>    git submodule status 2>/dev/null
>    # main workspace + each submodule path:
>    git -C <path> symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##'
>    ```
>    Report a `repos` list: one entry per repo `{path, default_branch, remote}`
>    where `path: "."` is the main workspace. If there are no submodules, report a
>    single `.` entry.
>
> 9. **Schema files**: probe for `prisma/schema.prisma`,
>    `<api-dir>/prisma/schema.prisma`, `*.graphql` files under source dirs.
>    Report exact path(s) found.
>
> 10. **Module convention**: probe for `<api-dir>/src/modules/*/`,
>     `src/modules/*/`, `apps/*/`, `packages/*/`, `services/*/`,
>     `src/features/*/`. Report the pattern with the most matching subdirs
>     that each contain at least one `.ts`/`.js`/`.py`/`.go` source file.
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
> - **Docs convention**: `streaming-docs-convention` | `flat-layout` | `none`
> - **Docs sub-paths present**: list of which sub-paths from item 7 exist
> - **Git remote host**: github / gitlab / bitbucket / other
> - **Default branch**: main / master / other (main workspace)
> - **Repos**: list of `{path, default_branch, remote}` — main workspace `.` plus
>   any submodules, each with its own default branch (may differ — `main` vs `master`)
> - **Schema paths**: prisma / graphql paths found, or "none"
> - **Module glob**: pattern with the most subdirs containing source files
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

## Step 4 — Derive docs + state paths (AI auto-fill, user confirms)

Use `survey.docs_root` + `survey.docs_convention` + `survey.docs_sub_paths_present`
to compute all paths automatically. Present one bulk confirmation card — user
approves the whole set, or selects which fields to override.

**Derivation rules:**

```
docs_root = survey.docs_root  (or null if user wants to skip Phase 5)

if survey.docs_convention == "streaming-docs-convention":
  DOCS_PREFIX  = "<docs_root>/documents"
  state_root   = "<docs_root>/workflow"
  state_in_vcs = true                           # commit state files (project history)
else:
  DOCS_PREFIX  = "<docs_root>"
  state_root   = ".workflow"
  state_in_vcs = false                          # add to .gitignore

module_docs_root        = "<DOCS_PREFIX>/modules"
feature_records_subdir  = "features"
api_docs_filename       = "api.md"
workflow_links_filename = "workflow-links.md"
db_docs_root            = "<DOCS_PREFIX>/database"
diagrams_root           = "<db_docs_root>/diagrams"
master_erd_path         = "<diagrams_root>/00-database-overview-erd.puml"
oq_docs_path            = "<DOCS_PREFIX>/overview/open-questions.md"
adr_docs_path           = "<DOCS_PREFIX>/overview/architecture-overview.md"
```

If a sub-path from `survey.docs_sub_paths_present` is missing from the derived
defaults (e.g. project uses non-standard naming), surface that as a hint —
do not silently drop it.

**Confirmation card — present ALL derived paths in one card:**

```
Detected docs convention: <streaming-docs-convention | flat-layout | none>

Proposed configuration (derived from project survey — review and confirm):

  Workflow state
    state_root:               <state_root>          [will be <gitignored | committed>]

  Docs (Phase 5 persistence)
    docs_root:                <docs_root>
    module_docs_root:         <module_docs_root>
    feature_records_subdir:   <feature_records_subdir>
    api_docs_filename:        <api_docs_filename>
    workflow_links_filename:  <workflow_links_filename>

  Database (Phase 5 — only if project has relational DB)
    db_docs_root:             <db_docs_root>
    diagrams_root:            <diagrams_root>
    master_erd_path:          <master_erd_path>

  Overview (cross-cutting)
    oq_docs_path:             <oq_docs_path>
    adr_docs_path:            <adr_docs_path>

Accept all? [Y]es / [e]dit specific fields / [s]kip Phase 5 entirely: ___
```

- **Y / Enter** → accept all, proceed to Step 5 (project conventions)
- **e** → ask which field(s) to edit (multi-pick or comma-separated). For each
  picked field, ask the value (with current default in `[...]`)
- **s** → set all doc fields to `null`, skip Phase 5 in w-task

**Concrete example for streaming-workspace** (the wizard would present this card
verbatim with values pre-filled):

```
Detected docs convention: streaming-docs-convention (found documents/ + workflow/)

Proposed configuration:

  state_root:               streaming-docs/workflow              [committed]

  docs_root:                streaming-docs
  module_docs_root:         streaming-docs/documents/modules
  feature_records_subdir:   features
  api_docs_filename:        api.md
  workflow_links_filename:  workflow-links.md

  db_docs_root:             streaming-docs/documents/database
  diagrams_root:            streaming-docs/documents/database/diagrams
  master_erd_path:          streaming-docs/documents/database/diagrams/00-database-overview-erd.puml

  oq_docs_path:             streaming-docs/documents/overview/open-questions.md
  adr_docs_path:            streaming-docs/documents/overview/architecture-overview.md

Accept all? [Y]es / [e]dit specific fields / [s]kip Phase 5 entirely: ___
```

State path under streaming-docs convention is **part of the project's documented
history** — task intake, plan, impact, verify files are valuable artefacts.
They are committed alongside docs, not gitignored.

---

## Step 5 — Project conventions (AI auto-fill, user confirms)

Same pattern as Step 4: AI derives everything from `survey`, presents one
confirmation card.

**Derivation rules:**

```
module_glob       = survey.module_glob              # e.g. "streaming-api/src/modules/*"
schema_paths:
  prisma          = survey.schema_paths.prisma      # e.g. "streaming-api/prisma/schema.prisma"
  graphql         = survey.schema_paths.graphql     # e.g. "streaming-api/src/**/*.graphql"
test_layers       = derived from survey.language(s) + framework markers:
                      - has @nestjs/* in deps      → include "nestjs"
                      - has @apollo/* or *.graphql → include "graphql"
                      - has bullmq in deps         → include "bullmq"
                      - has next in deps           → include "nextjs"
                      - jest/vitest config         → include "unit"
                      - any docker-compose.test.*  → include "integration"
                    fallback: ["unit"]
```

**Confirmation card:**

```
Project conventions (detected from survey):

  module_glob:       <pattern>
  schema_paths:
    prisma:          <path or "—">
    graphql:         <pattern or "—">
  test_layers:       <list>

Accept all? [Y]es / [e]dit specific fields: ___
```

**Concrete example for streaming-workspace:**

```
Project conventions:

  module_glob:       streaming-api/src/modules/*
  schema_paths:
    prisma:          streaming-api/prisma/schema.prisma
    graphql:         streaming-api/src/**/*.graphql
  test_layers:       [unit, integration, graphql, bullmq, nestjs, nextjs]

Accept all? [Y]es / [e]dit specific fields: ___
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

## Step 7 — Repos & PR settings

### 7a — Repos (per-repo default branch)

Use `survey.repos` to present the repo topology. Each repo (the main workspace and
every submodule) carries its **own** default branch — they need not agree.

**Single-repo project** (no submodules) — confirm one value:
```
Default branch for PRs [<survey.repos[0].default_branch or "main">]: ___
```
Record as `repos: [{path: ".", default_branch: <value>, remote: origin}]`.

**Superproject with submodules** — present the detected list, let developer fix any:
```
Detected repos (each has its own default branch — main vs master is fine):

  .            default_branch: main      remote: origin   (main workspace)
  apps/api     default_branch: master    remote: origin   (submodule)
  apps/web     default_branch: main      remote: origin   (submodule)

Accept all? [Y]es / [e]dit a repo's default branch: ___
```
- **e** → ask which path, then the new `default_branch`, re-show.
Record the full `repos:` list.

### 7b — PR options (apply to every repo)

```
Open PRs as drafts? (y/n) [y]: ___
Path to PR body template file (optional, Enter to skip): ___
```

Record `pr.draft`, `pr.template`. `pr.default_branch` is kept in the written file
(= the main workspace `.` default branch) as a fallback for older consumers.

---

## Step 8 — Write config

Write `.claude/workflow.yaml`:

```yaml
# Generated by /w-setup — edit manually if needed
# Consumed by: w-task, w-fix, w-status, w-reset, w-checkpoint, w-pr
version: 2

# Repos this workflow operates on. path "." is the main workspace; the rest are
# git submodules. Each repo has its OWN default branch — they need not agree
# (one may target `main`, another `master`). w-task Phase 6 syncs and opens a PR
# per repo against the branch named here.
repos:
  - path: "."
    default_branch: <branch>           # e.g. main
    remote: origin
  # - path: apps/api                   # a git submodule
  #   default_branch: master
  #   remote: origin

issue_tracker:
  type: <github|plane|jira|linear|none>
  # tracker-specific fields only when type != github/none:
  url: <url>
  workspace: <workspace>
  project: <project>
  mcp_available: <true|false>      # plane only

workflow:
  state_root: <path>                       # default: .workflow
  docs_root: <path or null>                # null = skip Phase 5 in w-task
  # Structured doc paths (all optional — blank disables the corresponding skill)
  module_docs_root: <path or null>         # e.g. docs/modules — <NN>-<name>/ folders
  feature_records_subdir: <string or null> # e.g. features (inside each module dir)
  api_docs_filename: <string or null>      # e.g. api.md
  workflow_links_filename: <string or null># e.g. workflow-links.md
  db_docs_root: <path or null>             # e.g. docs/database
  diagrams_root: <path or null>            # e.g. docs/database/diagrams
  master_erd_path: <path or null>          # mandatory sync target on any sub-ERD change
  oq_docs_path: <path or null>             # e.g. docs/overview/open-questions.md
  adr_docs_path: <path or null>            # e.g. docs/overview/architecture-overview.md

project:
  test_command: <command or null>
  typecheck_command: <command or null>
  lint_command: <command or null>
  src_dirs: <list from survey, or []>
  module_glob: <glob or null>              # e.g. src/modules/* — drives module auto-detect
  schema_paths:
    prisma: <path or null>                 # e.g. prisma/schema.prisma
    graphql: <glob or null>                # e.g. src/**/*.graphql
  test_layers: <list or [unit]>            # e.g. [unit, integration, graphql, bullmq]

pr:
  default_branch: <branch>           # = repos[path="."].default_branch — fallback for older consumers
  draft: <true|false>                # applies to every repo's PR
  template: <path or null>
```

**Gitignore handling (state_root-dependent):**

- If `state_root == ".workflow"` (default flat layout): the folder is ephemeral
  scratch state. Add to `.gitignore` if not present:
  ```bash
  grep -q "^\.workflow" .gitignore 2>/dev/null || echo ".workflow/" >> .gitignore
  ```

- If `state_root` is under `docs_root` (streaming-docs convention, e.g.
  `streaming-docs/workflow`): state files are **part of the project's documented
  history** — task intake, plan, impact, verification are valuable artefacts.
  Do NOT gitignore. Commit normally alongside docs. Skip this step.

Detection: if the path begins with `<docs_root>/` AND `<docs_root>` is tracked
in git → treat as docs-companion state, no gitignore.

---

## Step 9 — Summary

```
✓ .claude/workflow.yaml written

Survey applied:
  Language:     <language(s)>
  Source dirs:  <list>
  Commands:     from CI / detected / manual

Config written:
  Version:        2
  Repos:          <N> (. → <branch>[, apps/api → master, ...])
  Issue tracker:  <type>
  State root:     .workflow/  (added to .gitignore)
  Docs root:      <path or "skipped">
   ├ Module docs:  <module_docs_root or "—">
   ├ DB docs:      <db_docs_root or "—">
   ├ Master ERD:   <master_erd_path or "—">
   ├ OQ doc:       <oq_docs_path or "—">
   └ ADR doc:      <adr_docs_path or "—">
  Module glob:    <module_glob or "—">
  Test:           <command or "none">
  Typecheck:      <command or "none">
  Lint:           <command or "none">
  PR:             <draft/open>, one PR per repo against its own default branch

Next steps:
  /w-task <title or issue URL>      — start a feature task
  /w-fix  <title or issue URL>      — fix a bug or small change
  /w-status                         — check current task state
  /w-document-build-up              — bootstrap docs from existing source code
                                      (run BEFORE /w-task if docs/ is empty)
```
