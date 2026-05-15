# OLD SKILL RESPONSE — eval-4-pptx-shared-scripts

## Simulated response following the 7-step old skill pipeline

---

Great question! Let me walk through all 7 steps for the `pptx` skill from `anthropic-skills`.

---

## Step 1 — Browse

```bash
git submodule update --remote upstream/anthropic-skills
ls upstream/anthropic-skills/skills/
```

Available skills include: `pptx`, `docx`, `xlsx`, `pdf`, `claude-api`, etc.

Checking claudekit:
```bash
ls claudekit/skills/
```

`pptx` is **already vendored** in `claudekit/skills/pptx/`. It has a `SOURCE.yaml` with commit `d211d437...`. Since it's already present, the question is whether to upgrade — `pnpm sync skills/pptx` would show the diff.

---

## Step 2 — Evaluate

Reading `upstream/anthropic-skills/skills/pptx/SKILL.md`:

- **Purpose**: Create, read, edit, or manipulate `.pptx` files
- **License**: Proprietary (Anthropic). `LICENSE.txt` present.
- **Already vendored**: Yes — `claudekit/skills/pptx/SOURCE.yaml` exists

**External dependencies noted:**
- `python -m markitdown` → `markitdown` Python package
- `python scripts/office/soffice.py` → LibreOffice (`soffice`) system binary
- `python scripts/thumbnail.py` → `python-pptx` Python package

**Internal dependencies**: The old skill says to "note them" — but provides no structured scan process. A quick glance at the SKILL.md doesn't surface any explicit references to other skills by name. The `scripts/office/` shared code question raised by the user is **not addressed** by this step — there's no guidance on how to detect or handle it.

---

## Step 3 — Vendor (already done)

`pptx` is already in `claudekit/skills/pptx/`. No action needed for vendoring — this is an existing component. If upgrading, we'd run `pnpm sync skills/pptx`.

---

## Step 4 — Sidecar (existing)

`claudekit/skills/pptx/SOURCE.yaml` already exists with:
- `commit: d211d437...`
- `dependencies.required`: all empty
- `dependencies.external`: empty (missing `markitdown`, `soffice`!)

The user's question about `scripts/office/` being shared with `docx` and `xlsx` is **not addressed** here. The old skill has no mechanism to:
1. Detect the shared code
2. Decide whether `docx`/`xlsx` need to be picked as dependencies
3. Document the relationship in the sidecar

---

## Step 5–7 — Preset / Install / Verify

Since `pptx` is already vendored, these steps would apply only if adding it to a new preset. No further action unless the user wants to install.

---

## Answer to the user's question

> "I noticed pptx shares scripts/office/ with docx and xlsx, do I need to pick those too?"

**Old skill response:** The old skill's Step 2 mentions checking "internal dependencies (other skills, hooks, agents this component requires)" but gives no specific guidance on:

- **How** to detect the `scripts/office/` sharing
- **Whether** shared scripts constitute a dependency
- **What to do** with existing claudekit components that overlap

Based on the old skill's guidance, I would say: "No, you don't need to pick docx or xlsx as dependencies — pptx doesn't explicitly reference them as skills. The `scripts/office/` similarity is incidental." 

However, **this answer is incomplete** because:
- It doesn't confirm via `diff` whether the files are identical
- It doesn't note the shared code in the sidecar for future upgraders
- It doesn't address what happens when `docx` gets an upstream update to `scripts/office/` — `pptx` would silently fall behind
- The `dependencies.external` in the existing SOURCE.yaml is empty even though `markitdown` and LibreOffice are required

---

## What the old skill produces for SOURCE.yaml dependencies

The existing SOURCE.yaml has:
```yaml
dependencies:
  required:
    agents: []
    skills: []     ← no cross-reference to docx/xlsx noted
    commands: []
    hooks: []
    rules: []
  optional: ...
  external: []     ← missing markitdown, soffice!
```

The shared `scripts/office/` situation is completely unaddressed, and the external deps are missing.
