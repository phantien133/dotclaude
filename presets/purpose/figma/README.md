# figma

Design-to-code suite built on the **official** Figma MCP server, with subagents for token
isolation and a hard verification gate.

## The problem it fixes

Implementations that are *close to* the design rather than the design: invented icons,
spacing rounded to the nearest scale step, guessed backgrounds, borders and font sizes.

That failure has one root cause — the model never actually saw the design. The legacy
`f-*` suite talks to the REST server (`@figma/mcp`), which returns JSON and nothing else:
no rendered screenshot, no asset endpoint, no computed design context. Working from that,
the model fills the gaps with plausible values, and nothing downstream ever checks.

## How it works

```
Figma URL
   │
   ├─ figma-context-extractor  ──▶ figma-spec.md + figma-screens/
   │     get_metadata → get_design_context → get_variable_defs
   │     → get_screenshot → get_code_connect_map
   │
   ├─ figma-asset-fetcher      ──▶ figma-assets.md + real .svg/.png on disk
   │     downloads from the MCP asset endpoint, verifies every file
   │
   ├─ figma-design-system-mapper ──▶ figma-mapping.md
   │     Figma variable → project token, with exact | near(δ) | none
   │
   ├─ [main agent writes the code, reading those three files]
   │
   └─ figma-visual-verifier    ──▶ figma-parity-report.md
         renders in Chrome, diffs getComputedStyle against the spec,
         checks every asset resolves, compares to the Figma screenshot
```

Each agent absorbs its own MCP payload and hands back a file path. The main context holds
three small files instead of megabytes of design JSON — which is both the token strategy
and the reason exact values survive to the point where code gets written.

## Components

| Type | Name | Source | Role |
|---|---|---|---|
| agent | `figma-context-extractor` | self | All MCP reads → exact `figma-spec.md` |
| agent | `figma-asset-fetcher` | self | Real asset downloads, never generated |
| agent | `figma-design-system-mapper` | self | Figma values → project tokens/components |
| agent | `figma-visual-verifier` | self | Browser render vs design, numeric diff |
| skill | `figma` | openai-skills | MCP rules index + Claude Code config reference |
| skill | `figma-implement-design` | openai-skills | Primary design → code path |
| skill | `figma-verify-parity` | self | Completion gate, PASS required |
| skill | `figma-code-connect-components` | openai-skills | Node ↔ code component mapping |
| skill | `figma-create-design-system-rules` | openai-skills | Project-specific rules file |
| skill | `figma-use` | openai-skills | Canvas writes via `use_figma` |
| skill | `figma-generate-design` | openai-skills | Build a screen in Figma |
| skill | `figma-generate-library` | openai-skills | Build a component library in Figma |
| skill | `figma-create-new-file` | openai-skills | New Figma file |
| rule | `figma-fidelity` | self | Always-on no-guess contract |

The eight `openai-skills` entries are Figma's own Agent Skills, vendored from
`openai/skills` and governed by the **Figma Developer Terms** (`LICENSE.txt` ships with
each skill), not MIT. Each carries a dotclaude "Agent delegation" section; see the
`SOURCE.yaml` sidecars for the exact diff from upstream.

## Setup

```bash
claude mcp add --transport http figma https://mcp.figma.com/mcp
# then in Claude Code: /mcp  → authorise figma in the browser
```

The server must be registered under exactly the name `figma` — the agents pin
`mcp__figma__*` tool names.

`chrome-devtools` MCP installs automatically via npx and is required for the parity gate.

### figma-desktop fallback

For selection-based prompting (no URL needed) or when the remote endpoint is blocked:
enable the local MCP server in Figma desktop (Preferences), then point the `figma` entry at
`http://127.0.0.1:3845/mcp`. Keep the desktop app open with the target file loaded.

## Usage

```
Implement this: https://figma.com/design/<key>/<name>?node-id=12-34
```

`figma-implement-design` triggers on a Figma URL and runs the pipeline. Then:

```
/figma-verify-parity http://localhost:3000/checkout
```

Not complete until that returns `PASS`. `NOT RUN` (dev server down, MCP missing) is
deliberately a separate verdict — a skipped check must never read as a passing one.

## Relationship to the legacy `f-*` suite

Both can be installed together; `nextjs-combo` keeps `f-*` as a fallback for projects
still on the REST server. They must not both be registered under the MCP
server name `figma`. New work should use this suite.

| | `f-*` (legacy) | `figma` (this preset) |
|---|---|---|
| MCP server | `@figma/mcp` REST | official `mcp.figma.com` |
| Rendered reference | none | `get_screenshot` |
| Assets | manual export gate | downloaded from MCP endpoint |
| Design context | raw file JSON | `get_design_context` + `get_variable_defs` |
| Component reuse | grep by name | Code Connect map + token mapping |
| Verification | none | computed-style diff, gates completion |
