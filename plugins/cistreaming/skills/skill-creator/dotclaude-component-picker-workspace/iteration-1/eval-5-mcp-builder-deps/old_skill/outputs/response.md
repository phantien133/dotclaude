# mcp-builder — Vendor Pipeline (OLD SKILL, 7-step)

## Step 1 — Browse

```bash
git submodule update --remote upstream/anthropic-skills
ls upstream/anthropic-skills/skills/
# → mcp-builder is present
ls claudekit/skills/
# → mcp-builder already exists (was vendored earlier this session)
```

`mcp-builder` is already in `claudekit/skills/mcp-builder/`. Since it's already vendored, I'd normally run `pnpm sync skills/mcp-builder` to compare commits and decide whether to upgrade. For this eval we're treating it as a fresh vendor.

## Step 2 — Evaluate

Read `upstream/anthropic-skills/skills/mcp-builder/SKILL.md`:

- **Purpose**: Build MCP servers (Python FastMCP or Node/TS SDK)
- **License**: Apache-2.0 (LICENSE.txt confirmed)
- **Not already vendored** (treating as fresh)
- **External dependencies noted from SKILL.md**:
  - Python: `mcp>=1.1.0`, `anthropic>=0.39.0` (from `scripts/requirements.txt`)
  - Node/TypeScript: `@modelcontextprotocol/sdk` (mentioned in SKILL.md)
  - WebFetch calls to external URLs (modelcontextprotocol.io, github.com raw)
- **Internal dependencies**: The skill mentions no other claudekit skills explicitly. FastMCP is a Python package, not a claudekit component.

> **To answer the user's question directly:** Based on reading the SKILL.md and scanning `scripts/requirements.txt`, `mcp-builder` does **not** depend on any other claudekit skills. FastMCP (`mcp` Python package) is an external PyPI dependency, not a claudekit component. The `evaluation.py` and `connections.py` scripts import from `anthropic` and `mcp` (both PyPI), and from each other (local relative imports within the skill folder). No references to other skills in `claudekit/` were found.

## Step 3 — Vendor

```bash
git -C upstream/anthropic-skills rev-parse HEAD
# → d211d437443a7b2496a3dad9575e7dddd724c585

cp -r upstream/anthropic-skills/skills/mcp-builder/ claudekit/skills/mcp-builder/
```

## Step 4 — Sidecar

Create `claudekit/skills/mcp-builder/SOURCE.yaml`:

```yaml
# yaml-language-server: $schema=../../../presets/schema/sidecar.schema.json
source:
  repo: https://github.com/anthropics/skills
  commit: d211d437443a7b2496a3dad9575e7dddd724c585
  path: skills/mcp-builder
  ref: main
imported_at: "2026-05-08"
license: Apache-2.0
modified: false
modifications: null
notes: >-
  Build high-quality MCP servers (Python FastMCP or Node/TS MCP SDK).
  Includes reference/ design patterns and scripts/ implementation tools.
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
      reason: "scripts/evaluation.py and connections.py import mcp ClientSession"
    - name: anthropic
      type: python_pkg
      reason: "scripts/evaluation.py imports Anthropic client"
tags:
  - mcp
  - development
  - protocol
categories:
  purpose:
    - development
  mechanism:
    - guided-steps
```

## Steps 5–7 — Preset / Install / Verify

Add to a preset, run `pnpm install:project <preset> --symlink --force`, then `pnpm typecheck && pnpm test`.

---

## Assessment of old skill behavior

**What the old skill did well:**
- Correctly identified external PyPI deps from `requirements.txt` (anthropic, mcp)
- Answered the user's FastMCP question by reading SKILL.md and scripts

**What the old skill lacked (gap the new Step 2.5 fills):**
- No systematic grep scan — dependency detection was ad-hoc (read docs, spotted imports manually)
- No structured decision matrix for "is this a claudekit dep or external?"
- No check for shared-code patterns across other skills (didn't compare scripts/office/ etc.)
- `dependencies.external` was left empty in the actual SOURCE.yaml that was created earlier this session — the old skill didn't prompt for it explicitly enough
- No verification step: "does the existing claudekit mcp-builder sidecar's external[] match what we just found?"
