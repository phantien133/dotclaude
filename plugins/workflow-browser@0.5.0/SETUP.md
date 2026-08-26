# Setup — workflow-browser

This preset requires external tools not bundled in the plugin.
Complete the steps below after installing the plugin.

## External Dependencies

### mgrep `[claude_plugin]`

**Install:**
```sh
/plugins install mgrep@Mixedbread-Grep
```

**Docs:** https://github.com/mixedbread-ai/mgrep

**Notes:** Semantic code search plugin. settings_patch registers the Mixedbread-Grep marketplace and auto-enables the plugin.

### figma `[mcp_server]` *(moderate setup)*

**Install:**
```sh
claude mcp add --transport http figma https://mcp.figma.com/mcp — then run /mcp and authorise in the browser. For the local server instead, enable the MCP server in Figma desktop (Preferences) and point the url at http://127.0.0.1:3845/mcp.
```

**Docs:** https://developers.figma.com/docs/figma-mcp-server/

**Notes:** This is NOT the legacy @figma/mcp REST server. The official server provides get_design_context, get_metadata, get_variable_defs, get_screenshot, get_code_connect_map and a localhost asset endpoint — the rendered reference and real asset exports the legacy REST server never had. A project that keeps the old f-* suite installed must not register both under the name `figma`.

### chrome-devtools `[mcp_server]`

**Install:**
```sh
Auto-installs via npx. Requires Node.js and Google Chrome 144+.
```

**Docs:** https://github.com/ChromeDevTools/chrome-devtools-mcp

**Notes:** Used by w-task Phase 4c for localhost UI verification. Localhost-only constraint enforced by w-task skill instruction. Phase 4c is skipped gracefully when dev_server_command is not set in workflow.yaml.
