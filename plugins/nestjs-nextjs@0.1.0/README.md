# nestjs-nextjs

Full-stack NestJS + Next.js development workflow preset. Combines the complete `w-task`
workflow suite with Figma design integration and browser-based localhost verification.

## What's included

- **`w-task`** — full feature workflow (intake → context → plan → impact → UI/Figma → TDD → browser-verify → docs → PR)
- **`w-fix`** — quick fix workflow
- **All workflow helpers** — w-context-load, w-oq-check, w-impact-analyzer, w-adr, w-test-stubs, w-feature-record, w-api-doc, w-db-doc, w-doc-gate, w-document-build-up
- **Figma v2** — `f-extract` (one-shot MCP snapshot) + `f-implement` (code from snapshot, strict asset handling)
- **Figma classic** — f-import, f-ui-kit, f-page, f-review (backwards compatibility)
- **Chrome DevTools MCP** — `chrome-devtools-mcp` for Phase 4c localhost browser verification
- **NestJS + Next.js** framework patterns (from extends chain)
- **TDD guide**, planner, code-reviewer, and other agents (from developer chain)

## Extends

`nestjs` + `nextjs` → `developer` → `ai-native` → `core`

## Setup

```bash
# After installing the plugin
/w-setup         # configure workflow.yaml for this project
/f-setup         # configure figma.yaml (optional, for Figma integration)
```

Add to `workflow.yaml`:
```yaml
project:
  dev_server_command: "npm run dev"   # enables Phase 4c browser verify
  dev_server_port: 3000
```

## Workflow

```
/w-task <issue-url or title>    # start a new feature task
/w-task                          # advance to next phase
/w-fix <description>             # quick fix workflow
```
