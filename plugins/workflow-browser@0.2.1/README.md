# workflow-browser

Extends `developer` with the `w-task-v2` workflow skill, which adds **Phase 4c — Browser Verify** between TDD green and commit.

After code is GREEN and all checks pass, Claude:
1. Starts the local dev server (`project.dev_server_command` from `workflow.yaml`)
2. Uses Chrome DevTools MCP (`evaluate_script`) to assert UI elements at `localhost` only
3. Saves screenshots to the task state folder (no inline tokens)
4. Gates on developer review before committing

## Requirements

- **Chrome 144+** installed on the machine
- **Node.js** (for `npx chrome-devtools-mcp`)
- `project.dev_server_command` set in `.claude/workflow.yaml`

Phase 4c is skipped gracefully when `dev_server_command` is unset or when the plan has no UI changes.

## workflow.yaml additions

```yaml
project:
  dev_server_command: "npm run dev"   # command to start the local dev server
  dev_server_port: 3000               # port hint — if omitted, extracted from startup output
```

## Safety

Claude navigates **only** to `localhost:<port>` started by the dev server command. It never follows links outside `localhost`, never submits forms to external endpoints, and kills the server immediately after verification.

## Extends

- `developer` (→ `ai-native` → `core`)
