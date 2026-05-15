# mcp-builder: Cross-Reference & Dependency Scan (Step 2.5)

`mcp-builder` is already vendored in `claudekit/skills/mcp-builder/`. Here's the full Step 2.5 analysis, which shows what its SOURCE.yaml `dependencies` section should contain.

---

## Step 2.5a — Scan results

### References to other skills/agents in SKILL.md

No `use_skill`, `invoke`, or explicit references to other Claude Code skills were found. The SKILL.md references:
- `./reference/mcp_best_practices.md` — bundled reference inside the skill (self-contained)
- `./reference/node_mcp_server.md` — bundled reference (self-contained)
- `./reference/python_mcp_server.md` — bundled reference (self-contained)
- Two live WebFetch URLs (fetched at runtime, not a claudekit dependency):
  - `https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/README.md`
  - `https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md`

### Python imports in scripts/

`scripts/connections.py` imports:
```
from mcp import ClientSession, StdioServerParameters
from mcp.client.sse import sse_client
from mcp.client.stdio import stdio_client
from mcp.client.streamable_http import streamablehttp_client
```

`scripts/evaluation.py` imports:
```
from anthropic import Anthropic
from connections import create_connection   ← relative import within the skill's own scripts/
```

**Key finding:** `from connections import create_connection` is a relative import between two files in the same `scripts/` directory — not a reference to another claudekit component.

### requirements.txt

```
anthropic>=0.39.0
mcp>=1.1.0
```

These are PyPI packages, not claudekit skill dependencies.

### Shell scripts

None found.

### Shared scripts comparison

`scripts/` subtree is **identical only to itself** — no overlap with docx/xlsx/pptx office scripts or any other claudekit skill's scripts.

---

## Step 2.5b — Decision matrix applied

| Reference | Type | Decision |
|---|---|---|
| `mcp>=1.1.0` (PyPI) | External | → `dependencies.external`, `type: python_pkg` |
| `anthropic>=0.39.0` (PyPI) | External | → `dependencies.external`, `type: python_pkg` |
| `./reference/*.md` | Bundled within skill | Self-contained, no dependency entry needed |
| WebFetch URLs (MCP SDK READMEs) | Runtime fetch | Not a static dependency — no entry needed |
| `from connections import ...` | Internal to `scripts/` | Self-contained, no dependency entry needed |
| Other claudekit skills (claude-api, docx, etc.) | None referenced | No inter-skill deps found |

**Answer to your question:** `mcp-builder` does **not** depend on any other skills already in claudekit. `FastMCP` refers to the Python library (`fastmcp` / `mcp` PyPI package), not a Claude Code skill. The two Python packages in `requirements.txt` are external dependencies only.

---

## Step 2.5c — Shared code

No shared code pattern detected. `scripts/` is unique to `mcp-builder`.

---

## Correct SOURCE.yaml dependencies section

```yaml
dependencies:
  required:
    agents: []
    skills: []
    commands: []
    hooks: []
    rules: []
  optional:
    agents: []
    skills: []
    commands: []
    hooks: []
    rules: []
  external:
    - name: mcp
      type: python_pkg
      version: ">=1.1.0"
      reason: "scripts/connections.py and evaluation.py use mcp client (stdio, sse, streamable-http transports)"
    - name: anthropic
      type: python_pkg
      version: ">=0.39.0"
      reason: "scripts/evaluation.py uses Anthropic client to drive agent loop for MCP server evaluation"
```

---

## Next steps

Since `mcp-builder` is already vendored, check whether its existing `SOURCE.yaml` has these external deps populated:

```bash
cat claudekit/skills/mcp-builder/SOURCE.yaml
```

If `external: []` is empty, update it with the entries above and run `pnpm typecheck` to verify.
