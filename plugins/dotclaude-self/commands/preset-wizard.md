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

Ask the user the following questions. Combine into 1–2 messages — do not ask one at a time.

1. **Who uses this preset?** — role and experience level (e.g., solo full-stack dev, data scientist, DevOps engineer)
2. **What kind of project?** — (e.g., web API, mobile app, data pipeline, CLI tool, monorepo)
3. **Stack and languages** — (e.g., TypeScript + Next.js, Go + gRPC, Python + FastAPI)
4. **What should Claude help with?** — (e.g., code review, test writing, PR workflows, debugging, refactoring)
5. **External tools or MCP servers / Claude plugins?** — any tools to wire up alongside Claude (e.g., mgrep, browser automation, database tools). List names if known; say "none" if unsure.
6. **Install level** — user-level (all projects) or project-level (this project only)?
7. **Extends another preset?** — does this preset inherit from an existing one? (e.g., `core`, `ai-native`, or "none")

Wait for answers before continuing to Phase 2.

---

## Phase 2: Planning

### Step 2a — Determine preset kind

| Kind | Use when |
|---|---|
| `core` | Cross-stack baseline, minimal opinions, multiple projects |
| `framework` | Stack or language specific (e.g., `typescript-next`, `go-grpc`) |
| `purpose` | Workflow or role specific (e.g., `data-science-workflow`, `devops-k8s`) |

**If kind = `framework` and stack includes TypeScript/Node.js:**
Automatically surface all claudekit components tagged `framework-preset-candidate` as strong candidates.
These were intentionally scoped out of cross-stack core presets but are well-suited here — check their sidecar `notes` for context.

**If Q7 answered with a parent preset (extends is set):**
Before searching for new components, resolve the parent's inherited components:
1. Read `presets/<kind>/<parent>/preset.yaml` → collect its `components` list
2. For each inherited component, read its sidecar (`SOURCE.yaml` or `<name>.source.yaml`)
3. Check `categories.coverage` and `tags` — note any `js-only` or `js-example-heavy` inherited components
4. Present a brief **"Inherited coverage note"** section:
   ```
   Inherited from <parent>: <component-name> — ⚠ js-only / ℹ js-example-heavy / ✓ cross-stack
   ```
   This surfaces potential stack-fit issues before adding more components on top.

### Step 2b — Suggest a name

Kebab-case, lowercase, descriptive. Examples: `typescript-fullstack`, `python-data-science`, `go-backend`.
If the user hasn't specified a name, propose one based on elicitation answers.

### Step 2c — Search claudekit for matching components

Use `mgrep` to search claudekit for components relevant to the user's stack and requirements. Do NOT use bare `ls` or built-in Grep — use the `mgrep` skill (mandatory per project rules).

Example searches to run:
- `mgrep "<stack keyword>" claudekit/` — find components that mention the user's stack
- `mgrep "<use-case keyword>" claudekit/` — find components relevant to the stated use case
- `mgrep "<language>" claudekit/agents/ claudekit/skills/` — narrow to agents and skills

Combine results across searches. For each proposed component, state one concise reason why it fits.

**Coverage check — run after assembling candidate list:**

For each candidate, read its sidecar (`SOURCE.yaml` for folder components, `<name>.source.yaml` for file components) and check `categories.coverage` and `tags`:

| Sidecar signal | In a `core`/cross-stack preset | In a `framework/typescript` preset |
|---|---|---|
| `coverage: js-only` or tag `js-specific` | ⚠ Warn: JS-specific — suggest alternative or note none found | ✓ Good fit for this stack |
| tag `framework-preset-candidate` | 📌 Note: "Better fit in `presets/framework/typescript/`" | ✓ Actively recommend |
| `coverage: js-example-heavy` | ℹ Note: examples are JS but concept applies cross-stack | ✓ Good fit |
| No coverage tag | ✓ Cross-stack, no caveats | ✓ Include normally |

When warning about a JS-specific component in a cross-stack preset, check the sidecar `notes` for a suggested alternative and **auto-propose it as a replacement**:
- Scan the sidecar `notes` text for patterns like "use X instead", "replaced by X", "use X skill instead", "use security-bounty-hunter", etc.
- If an alternative is named, add it to the candidate list with ✓ marker and remove the js-only component:
  ```
  ~~security-review~~ (js-only — replaced)   →   security-bounty-hunter ✓ (from sidecar notes)
  ```
- If no alternative is named in notes, keep the ⚠ warning and note "no alternative found in claudekit".

### Step 2d — Suggest settings_patch

Based on stack and use case, propose relevant `settings_patch` entries. Common examples:
- Model preferences for specific tasks
- Permission allowlists for stack-specific binaries
- Language-specific lint/format flags

If no relevant patch is needed, use `{}`.

### Step 2d.5 — Plan external_setup entries + enable/disable decision

For each external tool or plugin the user mentioned in question 5:

**1. Classify the kind:**
- `claude_plugin` — installed via Claude Code plugin system (`/plugins install ...`)
- `mcp_server` — standard MCP server run via `npx` or similar
- `npm_global` — npm package installed globally
- `system_binary` — system-level binary (e.g., `ripgrep`, `fd`)
- `pip_package` — Python package

**2. For `claude_plugin` tools:**
Add marketplace registry to `settings_patch.extraKnownMarketplaces`:
```yaml
settings_patch:
  extraKnownMarketplaces:
    <MarketplaceName>:
      source:
        source: github
        repo: <owner>/<repo>
```

Then ask: **"Enable this plugin by default after install?"**
- If yes → also inject `enabledPlugins: { "<name>@<Marketplace>": true }` into `settings_patch`
- ⚠ Warning when install level is `user`: injecting `enabledPlugins` at user level affects **all projects**. Confirm with user before proceeding.

**3. For `mcp_server` tools:**
Add server config to `settings_patch.mcpServers`:
```yaml
settings_patch:
  mcpServers:
    <name>:
      command: npx
      args: ["-y", "@scope/package"]
```

Then ask: **"Enable this MCP server by default after install?"**
- If yes → add to `settings_patch` (the mcpServers entry itself acts as enablement)
- If no → document in `external_setup` only, omit from `settings_patch.mcpServers`

**4. For every external tool** (all kinds): add an `external_setup` entry:
```yaml
external_setup:
  - name: <tool-name>
    kind: claude_plugin   # claude_plugin | mcp_server | npm_global | system_binary | pip_package
    standalone: false
    install_hint: "<install command or instruction>"
    complexity: simple    # simple | moderate | complex
    docs_url: "https://..."  # optional
    notes: "..."             # optional
```

**5. Complexity classification:**
- `simple` — only settings_patch config needed, no extra install step
- `moderate` — one install command (npm, pip), no env vars
- `complex` — needs env vars, custom binary paths, or multi-step setup

**6. Complexity warning:** If any entry is `complexity: complex`:
> ⚠ `<name>` requires complex setup (env vars / custom install). This preset may not be portable without additional manual steps.

**7. Overly-broad tool warning:** If a tool requires cloning a repo, database setup, or multiple env vars:
> ⚠ `<name>` appears to be more than a simple standalone component. Consider whether it truly belongs in this preset or should be documented separately.

### Step 2e — Hook event mapping + default enable/disable

For each hook listed in `components.hooks`, determine:

**1. Infer the Claude Code event** from hook name (use heuristics + header comments if available):

| Hook name pattern | Default event | Default matcher |
|---|---|---|
| `pre-compact` | `PreCompact` | `""` |
| `session-end`, `desktop-notify`, `cost-tracker`, `evaluate-session`, `stop-*` | `Stop` | `""` |
| `post-edit-*` | `PostToolUse` | `"Edit"` |
| `post-bash-*` | `PostToolUse` | `"Bash"` |
| `pre-bash-*` | `PreToolUse` | `"Bash"` |
| `doc-file-warning`, `pre-write-*` | `PreToolUse` | `"Write"` |
| `suggest-compact`, `pre-compact-suggest` | `PreToolUse` | `""` |
| (default) | `PreToolUse` | `""` |

**2. Ask user for each hook:**
> "Hook `<name>`: fire on `<inferred-event>` — enable by default? (yes / no / change event)"

Defaults to **yes** for hooks that are non-blocking (warn-only). Default to ask for hooks that block or modify behavior.

**3. Generate `settings_patch.hooks` block** for all enabled hooks.

Path convention (fill based on `recommended_install_level`):
- `user` level → `~/.claude/hooks/<name>.js`
- `project` level → `.claude/hooks/<name>.js`

Example output:
```yaml
settings_patch:
  hooks:
    PreToolUse:
      - matcher: ""
        hooks:
          - type: command
            command: "node ~/.claude/hooks/suggest-compact.js"
      - matcher: "Write"
        hooks:
          - type: command
            command: "node ~/.claude/hooks/doc-file-warning.js"
    PreCompact:
      - matcher: ""
        hooks:
          - type: command
            command: "node ~/.claude/hooks/pre-compact.js"
    Stop:
      - matcher: ""
        hooks:
          - type: command
            command: "node ~/.claude/hooks/desktop-notify.js"
          - type: command
            command: "node ~/.claude/hooks/cost-tracker.js"
```

**4. Note:** Hook paths depend on install location. The README must document how to adjust paths if the user installs at a different level.

### Step 2f — Check coverage and invoke plugin-discovery if needed

Evaluate: do the available claudekit components fully cover the user's stated requirements?

**If there are clear gaps** (requirements no claudekit component addresses):
- Automatically invoke the `plugin-discovery` skill with the user's role, stack, and use cases as context.
- Include discovery results in the plan.

**Always** offer an opt-in at the end of the plan:
> "Would you also like me to search GitHub for external plugins that might fit your setup?"

If the user says yes, invoke `plugin-discovery` if not already done.

**Warning if no match found:**
> "⚠ No well-maintained external alternatives were found for [requirement]. You may need to build a custom component or proceed without coverage for this area."

### Step 2g — Present the plan

Format the proposal as:

```
## Proposed Preset: <name> (<kind>)

**For:** <who / context summary>
**Extends:** <parent preset or "none">
**recommended_install_level:** user / project

### Components
| Type | Name | Why | Coverage |
|------|------|-----|----------|
| agent | ... | ... | ✓ cross-stack / ⚠ js-only / ℹ js-example-heavy |
| skill | ... | ... | ... |
| hook  | ... | Event: <event> — enabled by default: yes/no |

### Hook wiring (settings_patch.hooks)
<yaml block or "(none)">

### External tools (settings_patch + external_setup)
| Tool | Kind | Auto-enabled | Install hint |
|------|------|-------------|-------------|
| ... | claude_plugin | yes | /plugins install ... |

### Other settings_patch
<yaml block or "(none)">

### Tags
<comma-separated list>
```

End with:
> "Does this plan look right? Reply **yes** to proceed, or describe any changes you'd like."

If the user requests changes, revise and re-present. Loop until explicit approval.

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
extends:
  - <parent-preset-name>   # omit array entirely if no parent
components:
  skills:
    - name: <skill-name>
      source: <everything-claude-code | anthropic-skills | dotclaude-self | workflow | figma | private>
  hooks:
    - name: <hook-name>
      source: <source>   # same alias list — points at claudekit/<source>/hooks/<name>.{js,sh,py}
settings_patch:
  hooks:
    <EventName>:
      - matcher: "<matcher or empty string>"
        hooks:
          - type: command
            command: "<path based on install level>"
  extraKnownMarketplaces:   # include only if claude_plugin external tools exist
    <MarketplaceName>:
      source:
        source: github
        repo: <owner>/<repo>
  enabledPlugins:           # include only if user chose auto-enable
    "<plugin>@<Marketplace>": true
external_setup:
  - name: <tool-name>
    kind: claude_plugin     # claude_plugin | mcp_server | npm_global | system_binary | pip_package
    standalone: false
    install_hint: "<install instruction>"
    complexity: simple
    docs_url: "https://..."
    notes: "..."
recommended_install_level: user   # user | project — omit if no strong recommendation
tags:
  - <tag>
use_case_tags:
  roles:
    - <role>
  project_types:
    - <project-type>
  stacks:
    - <stack>
  use_cases:
    - <use-case>
```

Only include component types that have entries — omit empty lists.
Omit `external_setup` entirely if no external tools were declared.
Omit `extends` array if no parent preset.

### Step 3a.5 — Note: hooks-manifest.js is auto-generated

`hooks/hooks-manifest.js` is generated automatically by `pnpm build-plugin` and `pnpm install:project` from `settings_patch.hooks` — do **not** create it manually as part of preset authoring.

The `/setup-hooks` skill (inherited from core) reads this file at runtime to provide interactive hook wiring.

### Step 3b — Create preset README

Create `presets/<kind>/<name>/README.md` with the following sections:

**Required sections:**
1. **What this preset is for** (1–2 sentences)
2. **Who should use it**
3. **Components table** — type, name, one-line description
4. **Hooks** — full hook reference with recommended defaults
5. **Enable / Disable after install** — per-hook and per-plugin instructions
6. **Install instructions**

**Hook reference section (§4) — generate one row per hook:**

```markdown
## Hooks

| Hook | Event | Matcher | Recommended | What it does |
|------|-------|---------|-------------|--------------|
| `suggest-compact` | `PreToolUse` | `""` | ✓ Enable | Warns when context window is near limit |
| `pre-compact` | `PreCompact` | `""` | ✓ Enable | Saves session state before compaction |
| `desktop-notify` | `Stop` | `""` | ✓ Enable | Desktop notification when Claude stops |
| `cost-tracker` | `Stop` | `""` | ✓ Enable | Logs session cost to `.claude/costs.log` |
| `pre-bash-commit-quality` | `PreToolUse` | `"Bash"` | ✓ Enable — blocks bad commits | Lint + conventional commit check before git commit |
| `doc-file-warning` | `PreToolUse` | `"Write"` | Optional | Warns before writing doc files |
| `post-edit-typecheck` | `PostToolUse` | `"Edit"` | Optional — TypeScript projects | Runs tsc after each file edit |
```

For each hook, populate the "Recommended" column based on the preset's use case:
- Hooks that are non-blocking and universally useful → **✓ Enable**
- Hooks that block or are stack-specific → **Optional** with a context note
- Hooks that are disruptive for this preset's workflow → **⚠ Consider disabling**

Then show the full `settings_patch.hooks` block for the **recommended defaults only**:

```yaml
## Recommended settings_patch (enabled hooks only)

settings_patch:
  hooks:
    PreToolUse:
      - matcher: ""
        hooks:
          - type: command
            command: "node ~/.claude/hooks/suggest-compact.js"   # user-level
            # command: "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/suggest-compact.js"  # project-level
    PreCompact:
      - matcher: ""
        hooks:
          - type: command
            command: "node ~/.claude/hooks/pre-compact.js"
    Stop:
      - matcher: ""
        hooks:
          - type: command
            command: "node ~/.claude/hooks/desktop-notify.js"
          - type: command
            command: "node ~/.claude/hooks/cost-tracker.js"
```

Include both path variants (user-level `~/.claude/hooks/` and project-level `${CLAUDE_PROJECT_DIR}/.claude/hooks/`) as comments so the user can switch based on their install level.

**"Enable / Disable after install" section (§5):**

```markdown
## Enable / Disable after install

### Hooks

Recommended hooks are pre-wired in `settings_patch`. To adjust after install:

| Hook | Event | To disable: remove from `settings.json` |
|------|-------|----------------------------------------|
| `suggest-compact` | PreToolUse | entry under `hooks.PreToolUse[matcher=""]` |
| `desktop-notify` | Stop | entry under `hooks.Stop` |
| `cost-tracker` | Stop | entry under `hooks.Stop` |
| `pre-bash-commit-quality` | PreToolUse (Bash) | entry under `hooks.PreToolUse[matcher="Bash"]` |

To **disable all hooks** temporarily, remove the `hooks` key from `settings.json`.

### Plugins / MCP servers

| Tool | How to disable |
|------|---------------|
| `mgrep` | Remove `"mgrep@Mixedbread-Grep": true` from `enabledPlugins` in `settings.json` |

### Full uninstall

```bash
pnpm uninstall:project <preset-name>   # project-level
pnpm uninstall:user <preset-name>      # user-level
```
```

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

### Step 3f — Generate AGENTS.md

Generate `presets/<kind>/<name>/AGENTS.md`. This file is auto-copied to the project root on `pnpm install:project`.

**Step 3f.1 — Resolve full agent list and version**

Collect agents from the preset and its entire `extends:` chain:
1. Read `preset.yaml` → extract `version:` field (default `"0.1.0"` if not set)
2. Read `preset.yaml` → `components.agents` (each entry is `{name, source}`)
3. For each preset in the extends chain (already resolved in Phase 2): collect their `components.agents`
4. Deduplicate by `name`. For each agent, read `claudekit/<source>/agents/<name>.md` → extract the `description:` frontmatter field.

**Step 3f.2 — Derive Core Principles**

Map `use_case_tags` and `stacks` to principles:

| Signal | Principle to include |
|---|---|
| stack contains TypeScript/JS | **Type safety** — leverage TypeScript strictly; no `any` casts |
| use_case includes `tdd` or skill `tdd-workflow` present | **Test-Driven** — write tests before implementation, 80%+ coverage |
| use_case includes `api-development` or skill `api-design` present | **API contracts first** — design endpoints before implementing |
| skill `security-review` present | **Security-first** — validate inputs, check auth on every route |
| skill `verification-loop` present | **Verify before done** — run verification loop before marking complete |
| (always) | **Plan before execute** — use planner for complex features |
| (always) | **Agent-first** — delegate domain tasks to specialized agents |

Include 4–6 principles maximum. Prefer specific ones over generic.

**Step 3f.3 — Build AGENTS.md content**

```markdown
# <Preset Display Name> — Agent Instructions

<one-sentence description from preset.yaml `description:` field>

**Version:** <version from preset.yaml>

## Core Principles

<numbered list of 4-6 principles from Step 3f.2>

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
<one row per agent — name from filename, Purpose + When from description field>

## Agent Orchestration

Use agents **proactively without waiting for the user to ask**:

- Complex feature requests (>3 files) → **planner**
- Code just written or modified → **code-reviewer**
- Architectural decisions or new module structure → **code-architect**
- Bug fix or new feature → **tdd-guide** (if present)
- Security-sensitive code → **security-reviewer** (if present)

Use parallel execution for independent sub-tasks — launch multiple agents simultaneously.
<add any preset-specific orchestration rules based on which agents are included>

## Security Guidelines

**Before ANY commit:**
- No hardcoded secrets (API keys, passwords, tokens)
- All user inputs validated at system boundaries
- SQL injection prevention (parameterized queries only)
- XSS prevention (sanitized HTML output)
- Authentication/authorization verified on every route
- Error messages do not leak sensitive data

**If a security issue is found:** STOP → invoke security-reviewer → fix CRITICAL issues → rotate any exposed secrets → scan codebase for similar patterns.
<add stack-specific security notes if security-review or nestjs-patterns skill is included>

## Coding Style

<one bullet per skill included (not inherited), describing its scope — derived from each skill's description frontmatter:>
- **<skill-name>**: <one-line scope description>

<if TypeScript/JS stack, add:>
- No `any` casts — use explicit types or generics
- Prefer immutability — create new objects rather than mutating

<if backend/API stack, add:>
- Functions under 50 lines; files under 400 lines
- Handle errors at every level — never swallow silently
```

**Step 3f.4 — Write and confirm**

Write to `presets/<kind>/<name>/AGENTS.md`.

Show the user a preview. Ask:
> "AGENTS.md generated. Does it look right? Reply **yes** to keep it, or describe changes."

If the user requests changes, revise and re-present. Loop until approval.

### Step 3g — Register preset in plugin index and README

After AGENTS.md is approved, update the two registry files:

**3g.1 — Update `docs/PLUGINS.md`**

Read `docs/PLUGINS.md`. Find the section that matches the preset's `kind`:
- `kind: core` → section `## Core`
- `kind: framework` → section `## Framework`
- `kind: purpose` → section `## Purpose`

Append a new table row at the bottom of the matching section:

```markdown
| [`<name>`](../plugins/<name>/) | [presets/<kind>/<name>/README.md](../presets/<kind>/<name>/README.md) | <description from preset.yaml> |
```

**3g.2 — Update root `README.md`**

Read `README.md`. Find the plugin table that matches the preset's `kind`:
- `kind: core` → table under `### Cross-stack baselines`
- `kind: framework` → table under `### Framework presets`
- `kind: purpose` → table under the appropriate `###` heading (create one if needed)

Append a new table row:

```markdown
| [`<name>`](./plugins/<name>/) | <version from preset.yaml> | <description from preset.yaml> | [README](./presets/<kind>/<name>/README.md) |
```

After writing both files, confirm:
> "Plugin index and README updated. Ready to install — see install instructions below."

---

## Phase 4: Handoff

### If all steps passed

Report:
- Files created (list all paths including preset.yaml, README.md, AGENTS.md)
- Build: ✓
- Tests: ✓ (or "skipped — no scripts in bundle")
- AGENTS.md: ✓
- Registry: ✓ (docs/PLUGINS.md + README.md updated)

Then show install instructions:
```bash
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
