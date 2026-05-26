# presales-workflow

Pre-sales developer workflow — ingest client documents (PDF/xlsx/Word), research
the web and GitHub, break down tasks, and produce estimation templates and proposals.

## Who should use it

Pre-sales developers and business analysts who need to:
- Extract requirements from client Capability Maps, SOW, RFPs, and planning documents
- Research vendors, technologies, and competitors online
- Break down client requirements into tasks with effort estimates
- Create and optimize xlsx estimation templates
- Co-author SOW and proposal documents

## Components

| Type | Name | Description |
|------|------|-------------|
| skill | `pdf` | Read, extract text/tables, merge, split, fill forms in client PDFs |
| skill | `xlsx` | Create and optimize Excel estimation templates; read client spreadsheets |
| skill | `docx` | Read/write Word documents for proposals, SOW, and reports |
| skill | `knowledge-ops` | Save and organize research findings across sessions |
| skill | `doc-coauthoring` *(inherited)* | Co-author SOW, proposals, and specs through structured workflow |
| skill | `github-ops` *(inherited)* | Search GitHub for code examples, libraries, vendor repos |
| agent | `planner` *(inherited)* | Break down client requirements into phased tasks with risk assessment |

## Hooks

Inherited from the `developer` chain — no new hooks added by this preset.

| Hook | Event | Matcher | Recommended | What it does |
|------|-------|---------|-------------|--------------|
| `suggest-compact` | `PreToolUse` | `Edit\|Write` | ✓ Enable | Warns when context window is near limit |
| `pre-compact` | `PreCompact` | `*` | ✓ Enable | Saves session state before compaction |
| `desktop-notify` | `Stop` | `*` | ✓ Enable | Desktop notification when Claude stops |
| `cost-tracker` | `Stop` | `*` | ✓ Enable | Logs session cost to `.claude/costs.log` |
| `doc-file-warning` | `PreToolUse` | `Write` | ✓ Enable | Warns before writing doc files |
| `post-edit-typecheck` | `PostToolUse` | `Edit` | ⚠ Consider disabling | Runs `tsc` after each file edit — noisy for non-TypeScript projects |
| `pre-bash-commit-quality` | `PreToolUse` | `Bash` | Optional | Lint + conventional commit check |
| `block-no-verify` | `PreToolUse` | `Bash` | Optional | Blocks `git commit --no-verify` |

## Install instructions

```bash
# Project-level (this project only):
pnpm install:project presales-workflow --force --symlink
```

> This preset is designed for **project-level** install. The parent presets
> (`core`, `developer`) default to user-level and use `~/.claude/hooks/` paths.
> After install, if you see hook errors, update the hook paths in
> `.claude/settings.json` from `~/.claude/hooks/` to
> `${CLAUDE_PROJECT_DIR}/.claude/hooks/`.

## External tool setup

### Tavily (web research)

1. Get a free API key at <https://tavily.com> (1,000 searches/month free)
2. After install, open `.claude/settings.json` and replace `YOUR_TAVILY_API_KEY_HERE` with your key:

```json
"mcpServers": {
  "tavily": {
    "command": "npx",
    "args": ["-y", "tavily-mcp"],
    "env": { "TAVILY_API_KEY": "tvly-xxxxxxxxxxxxxxxx" }
  }
}
```

> Without Tavily, `mgrep --web` (already included via core) still provides
> web search. Tavily adds structured research with better result quality.

### mgrep (already included)

mgrep is auto-enabled from the `core` preset. Use `mgrep --web "query"` for
quick web searches at any time — no additional setup needed.

## Enable / Disable after install

### Disable post-edit-typecheck (recommended for no-code projects)

Remove this entry from `.claude/settings.json` under `hooks.PostToolUse`:

```json
{ "matcher": "Edit", "hooks": [{ "type": "command", "command": "node ...post-edit-typecheck.js" }] }
```

### Disable all hooks temporarily

Remove the `hooks` key from `.claude/settings.json`.

### Full uninstall

```bash
pnpm uninstall:project presales-workflow
```
