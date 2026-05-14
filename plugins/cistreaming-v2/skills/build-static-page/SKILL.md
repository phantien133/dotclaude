---
description: Integrate AI-generated static page code into the current codebase using the existing UI kit components.
argument-hint: <path-to-generated-page-folder or module-name:path-to-generated-page-folder>
allowed-tools: Bash, Read, Write, Edit
model: claude-sonnet-4-6
---

You are a page integration engineer. Your job is to take AI-generated static page code and wire it into the current project, replacing ad-hoc component usage with the established UI kit.

## Step 1: Validate input and resolve scope

Parse `$ARGUMENTS`:
- If it contains `:`, split on the first `:` — the left side is the **module name**, the right side is the **source path**.
- Otherwise the entire value is the **source path** and there is no module scope.

Check that the source path exists:

```bash
ls "<source-path>" 2>/dev/null || echo "NOT_FOUND"
```

If `$ARGUMENTS` is empty or the source path does not exist, stop and tell the user:
> "Please provide a valid path to the generated page folder."
> Usage: `/build-static-page <path>` or `/build-static-page <module-name>:<path>`

**UI kit path:**
- Without module scope: `src/components/ui-kit/`
- With module scope: `src/components/<module-name>/ui-kit/`

## Step 2: Verify the UI kit

Check that the UI kit has been installed at the resolved path:

```bash
find <ui-kit-path> -type f 2>/dev/null | sort
```

If the directory does not exist or is empty, stop and tell the user:
> "No UI kit found at `<ui-kit-path>`."
> Run `/build-ui-kit <module-name>:<path>` (or `/build-ui-kit <path>` for global) first.

Read all files in the UI kit directory to build a catalogue of available components: their names, props, and what each renders.

## Step 3: Scan the source folder

List all files in the generated page folder:

```bash
find "<source-path>" -type f | sort
```

Read each file and identify:
- **page file(s)** — the main page component(s) to integrate
- **inline sub-components** — components defined inside the generated files that may map to UI kit components
- **style files** — `.css`, `.scss`, `.module.css`
- **other** — assets, utilities, config (note but skip)

If more than one page file is found, list them and ask the user:
> "Found multiple pages: <list>. Which one(s) should I build? Reply with filenames or 'all'."

**Stop and wait for the user's selection before continuing.** Proceed only with the selected page(s).

## Step 4: Detect page target path

Inspect the project structure and place the new page where existing pages live, following the same conventions.

## Step 5: Present the integration plan

Before writing any files, print a full plan:

```
## Integration plan

Source folder: <path>
Module scope: <module-name | global>
UI kit path: <resolved path>
Page target: <TargetPath>

Component mapping:
| Source | UI kit | Action |
|--------|--------|--------|
| <SourceComponent> | <UiKitComponent> | replace |
| <SourceComponent> | — | keep inline |

Transformations needed:
  - <list any HTML→React conversions, import rewrites, etc.>

Files that will be created or modified:
  - <TargetPath> (<created | updated>)
```

Ask the user: "Does this look correct? Reply yes to proceed, or describe any changes."

**Stop here and wait for confirmation before writing any files.**

## Step 6: Transform and write the page

For each page file:

1. Read the source.
2. Apply transformations:
   - Replace each mapped source component with its UI kit equivalent
   - Update all imports to point to `src/components/ui-kit/<Component>`
   - Remove inline component definitions that were replaced by UI kit equivalents
   - Convert HTML to React where needed (`class→className`, `for→htmlFor`, void element self-closing, inline style strings → objects)
   - Fix remaining relative imports to use the project's path alias
3. Write to the detected target path.
4. If a file already exists at the target path, write as `<name>-new.<ext>` and inform the user.

## Step 7: Handle styles

- CSS module → place next to the page file
- Global styles → append non-duplicate rules to the project's existing global stylesheet; skip if the project uses only Tailwind

## Step 8: Report

```
## Static page integration complete

### Page written
- <TargetPath>

### Component substitutions
- <SourceComponent> → <UiKitComponent> (<N> occurrences)
- ...

### Kept inline (no UI kit match)
- <ComponentName> — consider adding to the UI kit

### Skipped
- <file> — <reason>

### Manual follow-up needed
- <any props that need adjustment or styling gaps>
```
