# f-ui-kit — Integrate Figma Components into UI Kit

Integrates shared components, layout, and playground from a Figma manifest into the
project's component library. Replaces the old `build-ui-kit` skill with manifest-aware,
semantically-classified integration.

Called by `f-import` after manifest generation. Can also be invoked directly
for export-only workflows.

---

## Input

```
Manifest path (from f-import):
  f-ui-kit <manifest-path>

Direct export-only shorthand:
  /f-ui-kit src/exports/auth-export
  /f-ui-kit auth:src/exports/auth-export
```

Parse `$ARGUMENTS`:
- If contains `:` before a path → extract module scope from prefix
- If arg ends with `.yaml` → manifest mode
- Otherwise → export folder mode (build ad-hoc manifest inline)

---

## Step 0 — Validate

Read `.claude/figma.yaml` (error if missing → "Run /f-setup first").

Resolve:
- `module` = parsed scope or null
- `component_target` = `<cfg.output.component_base>/<module>/ui-kit/` or `<cfg.output.component_base>/ui-kit/`

---

## Step 1 — Load manifest (or build ad-hoc)

**Manifest mode:** Read `manifest.yaml`. Use `role` field for each component.

**Export folder mode:** Read all files in the folder. For each file, assign a role:

Classification order:
1. **Content analysis** — read the file:
   - Multiple named exports with variant props → `shared-component`
   - Single default export, large JSX tree, page-like structure → `page` (skip in this skill, handled by f-page)
2. **Filename heuristics** — if content is ambiguous:
   - Matches `/layout|shell|appshell|wrapper/i` → `layout`
   - Matches `/playground|demo|gallery/i` → `playground`
   - Matches `/button|input|badge|card|chip|avatar|tag|icon|select|checkbox|radio|toggle|tooltip|modal|dialog|spinner|loader/i` → `shared-component`
   - Otherwise → `page` (skip)
3. **Folder position:**
   - In `layout/` subfolder → `layout`
   - In `playground/` subfolder → `playground`

Build ad-hoc manifest structure in memory. Do not write to disk (no timestamp folder).

---

## Step 2 — Detect project conventions

Inspect the target project:

| Convention | How detected |
|-----------|-------------|
| Framework | `next.config.*` → Next.js; check `app/` vs `pages/` for router type |
| Import alias | `tsconfig.json` paths, `vite.config.*` resolve.alias |
| TypeScript | `tsconfig.json` present → `.tsx`; else `.jsx` |
| Styling | Read 2-3 existing components in `component_target` or `src/components` |

Playground target path (auto-resolved):

| Framework | Path |
|-----------|------|
| Next.js App Router | `app/playground/page.tsx` or `app/<module>/playground/page.tsx` |
| Next.js Pages Router | `pages/playground.tsx` or `pages/<module>/playground.tsx` |
| Vite / CRA | `src/pages/Playground.tsx` or `src/pages/<module>/Playground.tsx` |

---

## Step 3 — Show integration plan + confirm

```
## f-ui-kit integration plan

Source:           <manifest path or export folder>
Module:           <module or none>
Component target: src/components/auth/ui-kit/
Framework:        Next.js App Router
TypeScript:       yes
Import alias:     @/ → src/
Styling:          Tailwind

Shared components (5):
  Button.tsx  → src/components/auth/ui-kit/Button.tsx
  Input.tsx   → src/components/auth/ui-kit/Input.tsx
  Badge.tsx   → src/components/auth/ui-kit/Badge.tsx
  Card.tsx    → src/components/auth/ui-kit/Card.tsx
  Checkbox.tsx → src/components/auth/ui-kit/Checkbox.tsx

Layout (1):
  AuthLayout.tsx → src/components/auth/ui-kit/AuthLayout.tsx

Playground (1):
  Playground.tsx → app/auth/playground/page.tsx

Transformations: HTML→React conversions, import alias rewrite

Proceed? [y/n]
```

Wait for confirmation.

---

## Step 4 — Transform + write shared components

For each component with `role: shared-component`:

Apply transformations in order:

| Source issue | Transformation |
|-------------|---------------|
| Plain HTML (no function) | Wrap: `export default function <Name>() { return (<jsx>) }` |
| `class=` | → `className=` |
| `for=` | → `htmlFor=` |
| `<img>`, `<input>`, `<br>`, `<hr>` without self-close | → `<img />` etc. |
| `style="color: red; font-size: 14px"` | → `style={{ color: 'red', fontSize: '14px' }}` |
| Relative imports `./` or `../` to other components | Rewrite to `<alias>/components/<module>/ui-kit/<Name>` |
| Styling mismatch (e.g. plain CSS in Tailwind project) | Add `// NOTE: styling approach differs — review manually` |

Write to `component_target/<Name>.<tsx|jsx>`.

If file already exists at target: ask `overwrite / skip / rename to <Name>-new`.

---

## Step 5 — Integrate layout

If layout component found:

Check if a layout file already exists at `component_target/`:

- **Exists:** ask `overwrite / rename (as <Module>Layout) / skip`
- **Not exists:** write directly

For Next.js App Router `app/layout.tsx`:
- Read existing `app/layout.tsx`
- Inject UI kit shell as a child component inside `<body>`, preserving `<html>` and `<body>` wrappers
- Add import for the layout component

Write transformed layout to `component_target/<Module>Layout.<tsx|jsx>`.

---

## Step 6 — Integrate playground

Check if playground target already exists:

- **Exists:** append new component demos at the bottom (non-destructive). Do not overwrite existing demos.
- **Not exists:** create from source with transformations applied.

For Next.js App Router playground: ensure `"use client"` directive at top of file.

Update all imports to use `component_target` paths.

---

## Step 7 — Handle styles

| File type | Action |
|-----------|--------|
| `*.module.css` | Place next to its component in `component_target/` |
| Global stylesheet (with module scope) | Copy as `<module>.css`, import from module root index |
| Global stylesheet (no scope) | Read existing global stylesheet; append rules that are not already present |
| Tailwind-only project (`cfg.styling == tailwind`) | Skip all `.css` files |

---

## Step 8 — Update manifest installed_paths

If running in manifest mode: update each component entry's `installed_path` field in `manifest.yaml`.

---

## Step 9 — Report

```
## f-ui-kit complete

Components added (5):
  src/components/auth/ui-kit/Button.tsx
  src/components/auth/ui-kit/Input.tsx
  src/components/auth/ui-kit/Badge.tsx
  src/components/auth/ui-kit/Card.tsx
  src/components/auth/ui-kit/Checkbox.tsx

Layout:
  src/components/auth/ui-kit/AuthLayout.tsx (created)

Playground:
  app/auth/playground/page.tsx (created)

Skipped (page-role files — handled by f-page):
  SignIn.tsx, SignUp.tsx, ForgotPassword.tsx

Manual follow-up:
  - Badge.tsx: styling approach differs (plain CSS in Tailwind project) — review
```

---

## allowed-tools

Read, Write, Bash
