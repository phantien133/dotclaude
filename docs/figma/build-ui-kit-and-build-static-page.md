# build-ui-kit & build-static-page — How They Work

## Overview

Two complementary skills that take AI-generated code from a Figma export and wire
it into a real codebase. They are almost always used in sequence:

```
Figma design
    │
    ▼
[Figma export / MCP / Dev Mode]
    │
    ▼
build-ui-kit          ← imports shared components + layout + playground
    │
    ▼
build-static-page     ← builds a full page using the UI kit components
```

---

## build-ui-kit

**Purpose:** Take a folder of AI-generated UI components (from a Figma export) and
integrate them properly into the project — adapting file structure, imports, and
component format to match existing project conventions.

**Input:** `$ARGUMENTS` = path to the generated UI kit folder, optionally prefixed
with a module name:

```
/build-ui-kit src/exports/my-figma-export
/build-ui-kit auth:src/exports/auth-export    ← scoped to "auth" module
```

### Step 1 — Validate input & resolve scope

Checks that the source path exists. Determines:
- **Module scope** (if `:` present in arguments): components land at
  `src/components/<module>/ui-kit/`
- **No module scope**: components land at `src/components/ui-kit/`

### Step 2 — Scan the source folder

Lists all files recursively and categorises each into:

| Role | Description | Typical filenames |
|------|-------------|-------------------|
| `layout` | App shell, wrapper, frame | `Layout`, `Shell`, `AppShell`, files in `layout/` |
| `shared-component` | Reusable UI primitives | `Button`, `Card`, `Input`, `Badge` |
| `playground` | Component gallery/demo page | `Playground`, `ComponentGallery`, `Demo`, `index` in `playground/` |
| `style` | Stylesheets | `*.css`, `*.scss`, `*.module.css` |
| `other` | Assets, config, utilities | Skip |

Reads each file to understand source format (TSX/JSX/HTML) and styling approach.

### Step 3 — Detect project conventions

Inspects the *target* project (cwd) to determine:

| Convention | How detected |
|-----------|-------------|
| Framework | `next.config.*` → Next.js; `vite.config.*` → Vite; else CRA |
| Router type | `app/` dir → App Router; `pages/` dir → Pages Router |
| Import alias | `tsconfig.json` or `vite.config.*` path aliases (e.g. `@` → `src/`) |
| TypeScript | `tsconfig.json` present → `.tsx`/`.ts`; else `.jsx`/`.js` |
| Styling | Reads 2–3 existing components: Tailwind classes / CSS modules / plain CSS |

**Playground target path** (auto-resolved by framework):

| Framework | Path |
|-----------|------|
| Next.js App Router | `app/playground/page.tsx` or `app/<module>/playground/page.tsx` |
| Next.js Pages Router | `pages/playground.tsx` or `pages/<module>/playground.tsx` |
| Vite / CRA | `src/pages/Playground.tsx` or `src/pages/<module>/Playground.tsx` |

### Step 4 — Show plan & ask confirmation

Prints a full integration plan before writing anything:

```
## Integration plan

Source folder: src/exports/auth-export
Module scope:  auth
Component target: src/components/auth/ui-kit/
Target framework: Next.js App Router
TypeScript: yes
Import alias: @/ → src/
Styling: Tailwind

Components to integrate:
  - Button.tsx → src/components/auth/ui-kit/Button.tsx
  - Input.tsx  → src/components/auth/ui-kit/Input.tsx
  ...

Layout:
  - Layout.tsx → src/components/auth/ui-kit/AuthLayout.tsx

Playground:
  - Playground.tsx → app/auth/playground/page.tsx

Transformations needed:
  - Convert class= to className=
  - Rewrite relative imports to use @/ alias
```

**Waits for user confirmation before writing any files.**

### Step 5 — Transform & write shared components

For each shared-component file, applies transformations:

| Source issue | Transformation |
|-------------|---------------|
| Plain HTML | Wrap in named function component with `export default` |
| `class=` | → `className=` |
| `for=` | → `htmlFor=` |
| Void elements | Self-close: `<img />`, `<input />`, `<br />` |
| Inline style strings | `style="color:red"` → `style={{ color: 'red' }}` |
| Wrong imports | Rewrite to use project alias + target path |
| Styling mismatch | Add `// NOTE: styling approach differs` — preserve original |

Writes each to the resolved component target path.

### Step 6 — Integrate layout

- If a layout file already exists at target: asks user to overwrite / rename / skip.
- For Next.js App Router `app/layout.tsx`: injects UI kit shell as a child component,
  preserves existing `<html>` and `<body>` wrappers.

### Step 7 — Integrate playground page

- If playground exists: appends new component demos at the bottom (non-destructive).
- If not: creates from source with transformations applied.
- Updates imports to use integrated component paths.
- Next.js App Router: ensures `"use client"` directive at top.

### Step 8 — Handle styles

| File type | Action |
|-----------|--------|
| CSS module | Place next to its component |
| Global stylesheet (with module scope) | Copy as `<module>.css`, import from module root |
| Global stylesheet (no scope) | Append non-duplicate rules to existing global stylesheet |
| Tailwind-only project | Skip all `.css` files |

### Step 9 — Report

Prints summary: components added, layout action, playground path, skipped files,
manual follow-up items (styling mismatches, props needing adjustment).

---

## build-static-page

**Purpose:** Take AI-generated page code and wire it into the project — replacing
ad-hoc component usage with the established UI kit built by `build-ui-kit`.

**Prerequisite:** `build-ui-kit` must have already run. The skill verifies this.

**Input:** `$ARGUMENTS` = path to the generated page folder, optionally module-scoped:

```
/build-static-page src/exports/auth-pages
/build-static-page auth:src/exports/auth-pages
```

### Step 1 — Validate input & resolve scope

Same pattern as build-ui-kit. Also resolves the UI kit path:
- No scope: `src/components/ui-kit/`
- Module scope: `src/components/<module>/ui-kit/`

### Step 2 — Verify UI kit exists

Checks that the UI kit path from Step 1 contains files. If empty/missing:

> "No UI kit found at `<path>`. Run `/build-ui-kit <module>:<path>` first."

Reads all UI kit files to build a **component catalogue** — names, props, what each
renders — used in Step 5 for substitution mapping.

### Step 3 — Scan source folder

Reads all files in the generated page folder. Identifies:

| Role | Description |
|------|-------------|
| `page` | Main page component(s) to integrate |
| `inline sub-component` | Components defined inside the page that may map to UI kit |
| `style` | Stylesheets |
| `other` | Assets, utilities — noted but skipped |

If multiple page files: asks user which to build before continuing.
**Waits for selection.**

### Step 4 — Detect page target path

Inspects project structure to place the page alongside existing pages, following
the same conventions detected in Step 3 of build-ui-kit.

### Step 5 — Show integration plan & confirm

```
## Integration plan

Source folder: src/exports/auth-pages
Module scope:  auth
UI kit path:   src/components/auth/ui-kit/
Page target:   app/auth/sign-in/page.tsx

Component mapping:
| Source          | UI kit         | Action        |
|-----------------|----------------|---------------|
| PrimaryButton   | Button         | replace       |
| TextInput       | Input          | replace       |
| CustomCard      | —              | keep inline   |

Transformations needed:
  - HTML → React conversions
  - Import rewrites to @/ alias
  - Replace PrimaryButton with Button, TextInput with Input

Files to create/modify:
  - app/auth/sign-in/page.tsx (created)
```

**Waits for user confirmation before writing.**

### Step 6 — Transform & write page

For each page file:
1. Reads source.
2. Substitutes each mapped component with its UI kit equivalent.
3. Updates all imports to point to UI kit paths.
4. Removes inline component definitions that were replaced.
5. Applies HTML→React conversions (same as build-ui-kit Step 5).
6. Fixes remaining relative imports to use project alias.
7. Writes to target path. If file exists: writes as `<name>-new.<ext>` and notifies.

### Step 7 — Handle styles

Same rules as build-ui-kit Step 8.

### Step 8 — Report

Prints summary: page written, component substitutions with occurrence counts,
components kept inline (potential future UI kit additions), skipped files,
manual follow-up items.

---

## Typical Usage Patterns

### Pattern A — Figma Make export (ZIP)

```
1. Designer exports from Figma Make → ZIP
2. Dev extracts to local folder, e.g. src/exports/auth-export/
3. /build-ui-kit auth:src/exports/auth-export
   → components land at src/components/auth/ui-kit/
   → playground at app/auth/playground/page.tsx
4. /build-static-page auth:src/exports/auth-pages
   → sign-in page at app/auth/sign-in/page.tsx
```

### Pattern B — Figma Dev Mode link

```
1. streaming-figma reads CSS values from Dev Mode URL
2. Maps values to existing design tokens
3. /build-ui-kit <module>:<extracted-specs-path>
```

### Pattern C — Figma MCP (preferred, most accurate)

```
1. streaming-figma uses mcp__figma__* tools to fetch frame specs
2. Extracts component list + token values directly from Figma
3. /build-ui-kit <module>:<mcp-output-path>
4. /build-static-page <module>:<mcp-pages-path>
```

### Pattern D — Called from w-task Phase 3

```
w-task reaches Phase 3 (UI)
→ Detects UI changes in plan.md
→ Outputs: "Run /f-import <figma-url> when ready"
→ f-import determines path (MCP/Dev Mode/Export)
→ Invokes f-ui-kit → f-page
→ Developer verifies playground, runs /w-task to continue
```

---

## Key Design Choices

| Choice | Reason |
|--------|--------|
| Show plan + confirm before writing | Prevents unwanted file overwrites in complex projects |
| Non-destructive playground updates | Existing demos are preserved when re-running |
| CSS modules placed next to components | Keeps styling co-located, avoids global leakage |
| Styling mismatch leaves comment, not conversion | Auto-converting Tailwind↔CSS modules is error-prone |
| Inline-kept components noted in report | Signals UI kit gaps for future additions |

---

## Current Limitations (private version)

- Hardcoded to `streaming-web/src/` paths
- Design token mapping hardcoded to `streaming-web/src/styles/tokens.css`
- No MCP input path — MCP is handled by `streaming-figma` separately before invocation
- Playground always at `/app/<module>/playground` (Next.js App Router assumed)
- No design-vs-implementation review after integration
