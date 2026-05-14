---
description: Decision tree for Figma exports in the streaming project — guides choice between Figma Make, Dev Mode, and MCP, then hands off to build-ui-kit.
argument-hint: <module> [figma-url-or-path]
allowed-tools: Bash, Read, Write, Edit, Skill
---

# Streaming Figma

Determine the right Figma export path for this session, then execute.

## Decision Tree

Ask the developer (or infer from context):

```
Is MCP (Figma API) available in this session?
  YES → Use MCP path (most accurate, token-efficient)
  NO  → Does the designer export a Dev Mode link?
          YES → Use Dev Mode (inspect CSS values directly)
          NO  → Use Make export (ZIP from Figma Make)
```

## Path A — MCP (preferred)

Available when `mcp__figma__*` tools are in scope.

1. Fetch frame by URL or node ID
2. Extract component specs (fill, border-radius, spacing, typography tokens)
3. Map tokens to Tailwind classes or CSS vars already in `streaming-web/src/styles/`
4. Invoke `/build-ui-kit <module>:<component-list>` with extracted specs

## Path B — Dev Mode link

Developer provides a Figma Dev Mode URL.

1. Open URL to read CSS values, component names, variants
2. Map to existing design tokens in `streaming-web/src/styles/tokens.css`
3. Note any missing tokens — add to `tokens.css` before build
4. Invoke `/build-ui-kit <module>:<component-list>`

## Path C — Make export (ZIP)

Developer provides path to a Figma Make export ZIP or extracted folder.

1. Inspect exported structure: look for `components/`, `pages/`, `assets/`
2. Identify usable HTML/CSS skeletons vs generated noise
3. Extract reusable parts into `src/components/<module>/ui-kit/`
4. Invoke `/build-static-page <module>:<page-name>` for each page

## Output checklist

- [ ] Components landed in `streaming-web/src/components/<module>/ui-kit/`
- [ ] Pages landed in `streaming-web/src/app/(app)/<module>/`
- [ ] No hardcoded color values — all mapped to design tokens
- [ ] Playground route accessible at `/app/<module>/playground`
- [ ] `ui-inventory.md` written for this session
