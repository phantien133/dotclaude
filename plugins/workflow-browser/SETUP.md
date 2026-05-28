# Setup — workflow-browser

This preset requires external tools not bundled in the plugin.
Complete the steps below after installing the plugin.

## External Dependencies

### chrome-devtools `[mcp_server]`

**Install:**
```sh
Auto-installs via npx. Requires Node.js and Google Chrome 144+.
```

**Docs:** https://github.com/ChromeDevTools/chrome-devtools-mcp

**Notes:** Used by w-task-v2 Phase 4c for localhost UI verification. Localhost-only constraint enforced by w-task-v2 skill instruction. Phase 4c is skipped gracefully when dev_server_command is not set in workflow.yaml.
