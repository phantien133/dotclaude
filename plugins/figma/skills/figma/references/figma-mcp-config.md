# Figma MCP config reference (Claude Code)

> Retargeted from the upstream Codex `config.toml` version. Claude Code registers MCP
> servers in `.mcp.json` (project) or `settings.json` under `mcpServers`.

## Remote server — default

```json
{
  "mcpServers": {
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

Or from the CLI:

```bash
claude mcp add --transport http figma https://mcp.figma.com/mcp
```

Auth is OAuth: the first tool call opens a browser to authorise. Run `/mcp` in Claude Code
to check status and re-authenticate.

The remote server is **link-based** — it cannot see your Figma selection. Every call needs
a frame or layer URL so the server can extract the node ID.

## Local server — `figma-desktop` fallback

Use this when you want selection-based prompting (no URL) or when the org blocks the
remote endpoint. Requires the Figma desktop app running with the MCP server enabled
(Figma menu → Preferences → Enable local MCP server).

```json
{
  "mcpServers": {
    "figma": {
      "type": "http",
      "url": "http://127.0.0.1:3845/mcp"
    }
  }
}
```

With the local server, `fileKey` is omitted from tool calls — the server uses the open
file and the current selection.

## Verify

```bash
claude mcp list          # figma should be listed and connected
```

Then in a session, run `/mcp` and confirm the tool list includes `get_design_context`,
`get_metadata`, `get_screenshot`, `get_variable_defs`, `get_code_connect_map`.

Tools surface in Claude Code as `mcp__figma__<tool>` — for example
`mcp__figma__get_design_context`. Agents that pin a `tools:` list depend on the server
being registered under exactly the name `figma`.

## Not the same as the legacy REST server

`@figma/mcp` (REST, `FIGMA_API_KEY`) exposes `get_file`, `get_file_nodes`,
`get_file_components`, `get_local_variables` — and nothing else. It has no
`get_design_context`, no `get_screenshot`, and no asset endpoint, which is why designs
implemented through it drift: there is no rendered reference and no real asset to
download. The legacy `f-*` skill suite is built on that server; this suite is not. Do not
point both at the same server name.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Tools missing after config change | Server not reloaded | Restart Claude Code, then `/mcp` |
| 401 / auth loop on remote | OAuth token expired | `/mcp` → reconnect `figma` |
| Local server unreachable | Desktop app closed, or MCP server not enabled | Open Figma desktop, enable the local MCP server in Preferences |
| Output is generic React + Tailwind | Project rules not applied | Restate the project conventions from `SKILL.md`; consider generating a rules file with `figma-create-design-system-rules` |
| Response truncated on a large node | Node too deep | `get_metadata` first, then `get_design_context` per child node |
| Asset URLs 404 | Remote server without the local asset bridge | Switch to `figma-desktop`, or export the asset manually |

## Usage reminders

- Copy the link to the exact frame/layer/variant you want. The server reads the node ID
  from the URL; it does not browse the page.
- Required order for implementation work: `get_metadata` (if large) →
  `get_design_context` → `get_variable_defs` → `get_screenshot` → download assets → code.
