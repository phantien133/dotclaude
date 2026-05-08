---
description: Interactive wizard to create a new dotclaude preset. Elicits requirements step by step, proposes components from claudekit, builds and verifies the result. Run only when explicitly invoked with /preset-wizard.
---

# Preset Wizard

Interactive wizard for creating a new dotclaude preset from scratch.

**Rules:**
- Never auto-proceed between phases — each phase ends with a user interaction point.
- Never skip the confirmation loop; if the user requests changes, revise and re-present.
- Never attempt to fix build/test errors inline — hand off to `preset-debugger` skill.

---

## Phase 1: Elicitation

Ask the user the following questions. Combine into 1–2 messages — do not ask one question at a time.

1. **Who uses this preset?** — role and experience level (e.g., solo full-stack dev, data scientist, DevOps engineer)
2. **What kind of project?** — (e.g., web API, mobile app, data pipeline, CLI tool, monorepo)
3. **Stack and languages** — (e.g., TypeScript + Next.js, Go + gRPC, Python + FastAPI)
4. **What should Claude help with?** — (e.g., code review, test writing, PR workflows, debugging, refactoring)
5. **External tools or MCP servers?** — any tools that need to be wired up alongside Claude (e.g., mgrep for search, browser automation, database tools, custom MCP servers). List names if known; say "none" if unsure.
6. **Install level** — user-level (all projects) or project-level (this project only)?

Wait for answers before continuing to Phase 2.

---

## Phase 2: Planning

### Step 2a — Determine preset kind

| Kind | Use when |
|---|---|
| `core` | Cross-stack baseline, minimal opinions, multiple projects |
| `framework` | Stack or language specific (e.g., `typescript-next`, `go-grpc`) |
| `purpose` | Workflow or role specific (e.g., `data-science-workflow`, `devops-k8s`) |

### Step 2b — Suggest a name

Kebab-case, lowercase, descriptive. Examples: `typescript-fullstack`, `python-data-science`, `go-backend`.
If the user hasn't specified a name, propose one based on elicitation answers.

### Step 2c — Search claudekit for matching components

Use `mgrep` to search claudekit for components relevant to the user's stack and requirements. Do NOT use bare `ls` or built-in Grep — use the `mgrep` skill (mandatory per project rules).

Example searches to run:
- `mgrep "<stack keyword>" claudekit/` — find components that mention the user's stack
- `mgrep "<use-case keyword>" claudekit/` — find components relevant to the stated use case
- `mgrep "<language>" claudekit/agents/ claudekit/skills/` — narrow to agents and skills

Combine results across searches. For each proposed component, state one concise reason why it fits the user's requirements.

### Step 2d — Suggest settings_patch

Based on stack and use case, propose relevant `settings_patch` entries. Common examples:
- Model preferences for specific tasks
- Permission allowlists for stack-specific binaries
- Language-specific lint/format flags

If no relevant patch is needed, use `{}`.

### Step 2d.5 — Plan external_setup entries

For each external tool or MCP server the user mentioned in elicitation question 5:

1. **Classify complexity:**
   - `simple` — only needs config in `settings_patch` (e.g., standalone MCP server that runs via `npx`)
   - `moderate` — needs one install command (npm, pip) but no env vars
   - `complex` — needs env vars, custom binary paths, or multi-step setup

2. **For MCP servers:** add the server config under `settings_patch.mcpServers.<name>` (this is what actually gets injected into `settings.json`). Example:
   ```yaml
   settings_patch:
     mcpServers:
       mgrep:
         command: npx
         args: ["-y", "@mgrep/mcp-server"]
   ```

3. **For every external tool** (regardless of kind): add an `external_setup` entry with:
   - `name`, `kind` (mcp_server / npm_global / system_binary / pip_package)
   - `standalone: true/false`
   - `install_hint` (required if standalone: false)
   - `complexity` (simple / moderate / complex)
   - `docs_url` and `notes` if known

4. **Complexity warning:** If any entry is `complexity: complex`, include a prominent warning in the plan:
   > ⚠ `<name>` requires complex setup (env vars / custom install). This preset may not be portable to other machines without additional manual steps.

5. **Warning when non-standalone and too broad:** If the user describes an external tool that has more than just a single config or install step (e.g., requires cloning a repo, setting up a database, configuring multiple env vars), flag it:
   > ⚠ `<name>` appears to be more than a simple standalone component. Consider whether it truly belongs in this preset or should be documented separately.

### Step 2e — Check coverage and invoke plugin-discovery if needed

Evaluate: do the available claudekit components fully cover the user's stated requirements?

**If there are clear gaps** (requirements that no claudekit component addresses):
- Automatically invoke the `plugin-discovery` skill. Pass the user's role, stack, and use cases as context.
- Include the discovery results in the plan presented in Step 2f.

**Always** — offer an opt-in at the end of the plan:
> "Would you also like me to search GitHub for external plugins that might fit your setup?"

If the user says yes, invoke `plugin-discovery` if not already done.

**Warning if no match found:**
If `plugin-discovery` returns no high-quality results (i.e., no repos with substantial star counts or active maintenance), clearly state:
> "⚠ No well-maintained external alternatives were found for [requirement]. You may need to build a custom component or proceed without coverage for this area."

### Step 2f — Present the plan

Format the proposal as:

```
## Proposed Preset: <name> (<kind>)

**For:** <who / context summary>

### Components
| Type | Name | Why |
|------|------|-----|
| agent | ... | ... |
| skill | ... | ... |
| command | ... | ... |

### settings_patch
<yaml block or "(none)">

### Tags
<comma-separated list>

### Install level: user / project
```

End with:
> "Does this plan look right? Reply **yes** to proceed, or describe any changes you'd like."

If the user requests changes, revise the plan and re-present. Loop until the user explicitly approves.

---

## Phase 3: Execution

Execute only after explicit user approval.

### Step 3a — Create preset folder and files

Create `presets/<kind>/<name>/` and populate it:

**`presets/<kind>/<name>/preset.yaml`:**
```yaml
# yaml-language-server: $schema=../../schema/preset.schema.json
name: <name>
kind: <kind>
description: <one-line description>
version: 0.1.0
extends: []
components:
  agents:
    - <agent-name>
  skills:
    - <skill-name>
  commands:
    - <command-name>
  hooks: []
  rules: []
settings_patch: <patch or {}>
external_setup:
  - name: <tool-name>
    kind: mcp_server   # mcp_server | npm_global | system_binary | pip_package
    standalone: true
    install_hint: "npx -y @example/mcp-server"  # omit if standalone: true
    complexity: simple   # simple | moderate | complex
    docs_url: "https://..."  # optional
    notes: "..."             # optional
tags:
  - <tag>
```

Only include component types that have entries — omit empty lists.
Omit `external_setup` entirely if no external tools were declared.

Populate `use_case_tags` from the elicitation answers:
```yaml
use_case_tags:
  roles:
    - <user's role, kebab-case, e.g. "backend-dev", "data-scientist">
  project_types:
    - <project type, kebab-case, e.g. "web-api", "data-pipeline">
  stacks:
    - <language or framework, kebab-case, e.g. "typescript", "nextjs", "python">
  use_cases:
    - <what Claude should help with, kebab-case, e.g. "code-review", "tdd", "debugging">
```

### Step 3b — Create preset README

Create `presets/<kind>/<name>/README.md` with:
- What this preset is for (1–2 sentences)
- Who should use it
- Component list with one-line descriptions
- Install instructions

### Step 3c — Build and typecheck

Run in order and report the exact output of each:

```bash
pnpm typecheck
pnpm build-plugin <name>
```

If either fails, skip Steps 3d–3e and go directly to Phase 4 (handoff to preset-debugger).

### Step 3d — Generate vitest stubs

Inspect the built plugin output at `plugins/<name>/`. For each `.ts` script file found in the bundle:

1. Create a corresponding stub file at `src/__tests__/preset-<name>/<script-name>.test.ts`
2. Import the script's exported functions
3. Add one `it.todo('...')` per exported function describing its expected behavior
4. Do not write any assertions — stubs only

If no `.ts` script files exist in the bundle, skip this step.

### Step 3e — Run tests

```bash
pnpm test
```

Report pass/fail and any output.

---

## Phase 4: Handoff

### If all steps passed

Report:
- Files created (list paths)
- Build: ✓
- Tests: ✓ (or "skipped — no scripts in bundle")

Then show install instructions:
```
# Install at user level (all projects):
pnpm install:user <name> --force --symlink

# Install at project level (this project only):
pnpm install:project <name> --force --symlink
```

### If any step failed (typecheck, build, or tests)

Do not attempt to fix errors inline.

Invoke the `preset-debugger` skill and pass:
- Which step failed (typecheck / build-plugin / pnpm test)
- The exact error output
- The list of files created in Phase 3
