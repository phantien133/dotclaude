# nextjs-combo

Full-stack NestJS + Next.js workflow preset — the complete w-task state machine plus the
official Figma design-to-code pipeline.

Supersedes **`nestjs-nextjs`**, which is deprecated and receives no further features.

## What you get

| Area | Components |
|---|---|
| Workflow | `w-task`, `w-fix`, `w-checkpoint`, `workflow-setup`, and the phase helpers (`w-context-load`, `w-oq-check`, `w-impact-analyzer`, `w-adr`, `w-test-stubs`, `w-feature-record`, `w-api-doc`, `w-db-doc`, `w-doc-gate`, `w-document-build-up`) |
| Commands | `/w-setup`, `/w-status`, `/w-reset`, `/w-pr`, `/f-setup` |
| Figma | the whole `figma` preset — `figma-implement-design`, `figma-verify-parity`, four `figma-*` agents, the `figma-fidelity` rule, plus the legacy `f-*` suite as fallback |
| Stack | everything from `nestjs` and `nextjs` (which chain to `developer` → `core`) |
| Security | `security-review` — OWASP plus the cloud-infrastructure checklist |
| MCP | `figma`, `chrome-devtools`, `terraform` |

## Install

```bash
pnpm install:project nextjs-combo --force --symlink
```

Then, once per project:

```bash
claude mcp add --transport http figma https://mcp.figma.com/mcp
/w-setup            # writes .claude/workflow.yaml
```

`/f-setup` is only needed if you intend to use the legacy `f-*` Figma path.

## The Figma path

w-task Phase 3 resolves a `figma_engine` by probing which MCP tools exist:

| Available | Engine | Behaviour |
|---|---|---|
| `get_design_context` | `official` | `figma-context-extractor` → `figma-asset-fetcher` + `figma-design-system-mapper` → `figma-implement-design` → parity gate |
| only `get_file*` | `legacy` | `f-extract` → `f-implement`, with a warning that parity checking is degraded |
| neither | `none` | plan-only implementation, parity gate skipped and recorded as such |

The parity gate (Phase 3.4) renders the built screen, reads `getComputedStyle` for every
property the design pins, and fails the phase on any drift. `NOT RUN` is a distinct
verdict from `PASS` — a skipped check stays visible all the way into the PR description.

## Migrating from `nestjs-nextjs`

```bash
pnpm install:project nextjs-combo --force --symlink
```

The component sets overlap almost entirely; the additions are the `figma` preset's agents,
skills and rule, plus `security-review` and the terraform MCP server. Existing
`.claude/workflow.yaml` files carry over unchanged — `/w-setup` will offer to migrate the
config version if needed.
