---
description: Bootstrap wizard for first-time dotclaude setup. Guides a Claude Code user through locating or pulling dotclaude locally, understanding their goals, finding a suitable preset, and installing it. Run only when explicitly invoked with /dotclaude-setup.
---

# dotclaude-setup

One-time bootstrap wizard for users who know Claude Code but are new to dotclaude.
Guides from zero to a working preset install in one session.

**Rules:**
- Never auto-proceed between phases — each phase ends with a user interaction.
- Config values (dotclaude path, install level) must be saved before proceeding to preset search.
- Never run `git clone` or `git submodule` without explicit user approval.

---

## Phase 1 — Environment Check

### Step 1a — Detect dotclaude locally

Check common locations for an existing dotclaude clone:

```bash
ls ~/dotclaude/CLAUDE.md 2>/dev/null && echo "FOUND:~/dotclaude"
ls ~/.dotclaude/CLAUDE.md 2>/dev/null && echo "FOUND:~/.dotclaude"
ls ~/workspace/dotclaude/CLAUDE.md 2>/dev/null && echo "FOUND:~/workspace/dotclaude"
```

Also check if the current working directory is a dotclaude repo:
```bash
test -f CLAUDE.md && grep -q "dotclaude" CLAUDE.md 2>/dev/null && echo "FOUND:$(pwd)"
```

**If found:** confirm with the user — "Found dotclaude at `<path>`. Use this location? (yes / specify different path)"

**If not found:** present options (see Step 1b).

### Step 1b — Handle missing dotclaude

If dotclaude is not found, offer:

> dotclaude was not found on this machine. Choose how to proceed:
>
> **(A) [Recommended]** Clone dotclaude to `~/dotclaude/`
> ```sh
> git clone --recursive https://github.com/phantien133/dotclaude.git ~/dotclaude
> ```
>
> **(B)** Clone to a custom path (specify the directory)
>
> **(C)** I already have it — let me specify the path manually

Wait for the user's choice.

- For A or B: confirm then run the clone command (ask approval before running).
- For C: ask for the path and verify it with `ls <path>/CLAUDE.md`.

### Step 1c — Save config

Once the dotclaude path is confirmed, save it to `~/.claude/dotclaude-config.json`:

```json
{
  "dotclaude_path": "<confirmed-path>",
  "install_level": null
}
```

Create the file with Write tool. If it already exists, merge the `dotclaude_path` value in without overwriting other keys.

---

## Phase 2 — Onboarding

Ask the user (combine into one message):

1. **Install level** — Should the preset be available across all your projects, or just this one?
   - **User level** (`~/.claude/`) — available everywhere, recommended for most users
   - **Project level** (`.claude/` in current directory) — isolated to this project

2. **Goals** — What do you primarily want Claude Code to help with? (e.g., code review, writing tests, debugging, PR workflows, refactoring, documentation)

3. **Project type** — What kind of project are you working on? (e.g., web API, mobile app, data science, DevOps/infra, CLI tool, monorepo)

4. **Stack** — What languages and frameworks do you use? (e.g., TypeScript + Next.js, Python + FastAPI, Go, Rust)

5. **Role** — What's your role? (e.g., solo developer, team lead, data scientist, DevOps engineer)

Save the install level to `~/.claude/dotclaude-config.json` under `"install_level"`.

Wait for answers before continuing.

---

## Phase 3 — Catalog Search

Search for matching presets in `<dotclaude_path>/presets/` based on the user's answers.

### Step 3a — Fuzzy search on preset descriptions

Use `mgrep` to search preset `README.md` files for keywords from the user's goals, project type, and stack:

```bash
mgrep "<stack-keyword>" <dotclaude_path>/presets/
mgrep "<use-case-keyword>" <dotclaude_path>/presets/
mgrep "<role-keyword>" <dotclaude_path>/presets/
```

### Step 3b — Match against use_case_tags

Read each `preset.yaml` inside folders that showed up in Step 3a and check its `use_case_tags` fields:
- `roles` — does any entry match the user's role?
- `project_types` — does any entry match the user's project type?
- `stacks` — does any entry match the user's stack?
- `use_cases` — does any entry match the user's goals?

Score each preset: +1 per matching tag across all four dimensions. Sort by score descending.

### Step 3c — Present results

If matches found, present ranked results:

```
## Preset Matches for Your Setup

| Score | Preset | Kind | Description |
|-------|--------|------|-------------|
| 4/4   | typescript-fullstack | framework | Full-stack TS preset with code review + testing |
| 2/4   | developer            | core       | Cross-stack developer tooling for any project |
```

Ask:
> "Which preset would you like to install? Reply with the preset name, or 'build new' to create a custom one."

**Stack-fit check — run after the user selects a preset (before Phase 4):**

Read the selected preset's `preset.yaml` `components` list (including recursively resolving `extends`). For each component, read its sidecar and check `categories.coverage` and `tags`:

- If `coverage: [js-only]` or tag `js-specific`, and the user's stack (from Phase 2) does **not** include Node.js/TypeScript → surface a brief warning:
  > ℹ `<preset>` includes `<component>` which is JS/TS-specific. You mentioned `<user-stack>` — you may want to replace it after install. Check the preset README or the component's sidecar `notes` for the suggested alternative.

- Only warn for mismatches — no output for matching or universal components.
- If the preset extends a parent, check inherited components too.
- Limit to at most 3 warnings to avoid overwhelming the user; if more, summarise: "and N more js-specific components".

If no mismatches found, proceed silently.

If no matches found (score = 0 for all), or if the user chooses 'build new':

> "No existing preset closely matches your setup. Let's build a custom one."
> → Invoke `/preset-wizard` with the user's context pre-filled (role, stack, project type, goals, install level).

---

## Phase 4 — Install

### Step 4a — Dry run first

Run a dry run to show what will be installed:

```bash
cd <dotclaude_path>
pnpm install:<level> <preset-name> --dry-run
```

Present the output to the user. Ask: **"Proceed with install? (yes / no)"**

### Step 4b — Install

After approval:

```bash
cd <dotclaude_path>
pnpm install:<level> <preset-name> --force --symlink
```

Where `<level>` is `user` or `project` based on Phase 2.

Report the install output.

### Step 4c — Handle errors

If the install fails or if any `external_setup` instructions are printed, invoke the `preset-debugger` skill with:
- The preset name
- The exact error output
- The install level

---

## Phase 5 — Confirm & Next Steps

After successful install, report:

```
✓ Preset "<name>" installed at <level> level.

Components installed:
  <list from install output>

External setup (if any):
  <list from SETUP.md or external_setup entries>

You're ready to use dotclaude. Try:
  /preset-wizard   — create a new custom preset
  /preset-debugger — fix issues with any preset
```

If any external tools need manual setup (e.g., MCP server config), surface the SETUP.md from `<dotclaude_path>/plugins/<preset-name>/SETUP.md` if it exists. You can also check the preset's README at `<dotclaude_path>/presets/<kind>/<preset-name>/README.md` for any co-located setup notes.
