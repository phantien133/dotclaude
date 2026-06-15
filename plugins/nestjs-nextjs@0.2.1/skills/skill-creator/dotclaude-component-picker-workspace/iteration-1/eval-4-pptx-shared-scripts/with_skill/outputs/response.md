# Picking `pptx` from anthropic-skills — Cross-Reference & Dependency Scan

> **Status**: `pptx` is already vendored at `claudekit/skills/pptx/`. Running the full pipeline as if vendoring fresh, with emphasis on Step 2.5.

---

## Step 1 — Browse

`pptx` is a **folder component** in `upstream/anthropic-skills/skills/pptx/`. It is already in `claudekit/skills/pptx/` at commit `d211d437443a7b2496a3dad9575e7dddd724c585`. Since the task is about understanding the shared `scripts/office/` question, we proceed through the full pipeline rather than treating this as an upgrade.

Files in upstream:
```
editing.md   LICENSE.txt   pptxgenjs.md   scripts/   SKILL.md
```

---

## Step 2 — Evaluate

- **License**: Proprietary (Anthropic PBC). Personal use only, do not redistribute.
- **Already vendored**: Yes — same commit. No upgrade needed.
- **External dependencies** (noted from SKILL.md):
  - `python3` — all scripts require Python
  - `markitdown[pptx]` (PyPI) — text extraction
  - `Pillow` (PyPI) — thumbnail grids
  - `pptxgenjs` (npm) — creating from scratch
  - `soffice` / LibreOffice (system binary) — PDF conversion

---

## Step 2.5 — Cross-Reference & Dependency Scan

### 2.5a — Scan results

**References to other skills/agents in SKILL.md:**
```
grep -ni "skill|agent|use_skill|invoke|require|depends" upstream/anthropic-skills/skills/pptx/SKILL.md
```
Results (filtered for relevance):
- `"Use this skill any time a .pptx file is involved"` — self-reference in description, not a dependency
- `"QA (Required)"` — internal section header, not a component reference
- `"USE SUBAGENTS"` — runtime instruction about Claude behavior, not a claudekit dependency

**Verdict**: No references to other named skills, agents, commands, hooks, or rules.

---

**Python relative imports in `scripts/`:**
```
grep -rn "^from \.|^import \." upstream/anthropic-skills/skills/pptx/scripts/
```
Results:
```
scripts/office/validators/pptx.py:    from .base import BaseSchemaValidator
scripts/office/validators/__init__.py: from .base import BaseSchemaValidator
scripts/office/validators/__init__.py: from .docx import DOCXSchemaValidator
scripts/office/validators/__init__.py: from .pptx import PPTXSchemaValidator
scripts/office/validators/__init__.py: from .redlining import RedliningValidator
scripts/office/validators/docx.py:    from .base import BaseSchemaValidator
```

All imports use **relative dot-notation** (`from .base`, `from .docx`) — they resolve within the same `validators/` package. Notably:
- `validators/__init__.py` imports `DOCXSchemaValidator` from `validators/docx.py` — this is a **docx format validator bundled inside the pptx skill**, not a reference to `claudekit/skills/docx/`.
- No cross-skill Python imports exist.

**Verdict**: Self-contained package imports only. No dependency on `claudekit/skills/docx/` or any other external claudekit component.

---

**Shell script references:**
```
grep -rn "\.sh\b|source \." upstream/anthropic-skills/skills/pptx/ | grep -v "^Binary|LICENSE"
```
Result: **none**.

---

**Shared-code detection (Step 2.5c):**
```bash
for candidate in claudekit/skills/docx/scripts claudekit/skills/xlsx/scripts; do
  diff -rq upstream/anthropic-skills/skills/pptx/scripts/office/ "$candidate/office/"
done
```
Results:
```
claudekit/skills/docx/scripts/office/ → IDENTICAL
claudekit/skills/xlsx/scripts/office/ → IDENTICAL
```

The entire `scripts/office/` subtree (pack.py, validate.py, unpack.py, soffice.py, validators/, helpers/, schemas/) is **byte-for-byte identical** across `pptx`, `docx`, and `xlsx`.

Additionally, `pptx/scripts/` contains three **pptx-unique** scripts not present in docx/xlsx:
- `thumbnail.py` — creates slide thumbnail grids using Pillow
- `clean.py` — removes unreferenced files from unpacked PPTX dirs
- `add_slide.py` — adds a new slide to an unpacked PPTX dir

These are pptx-specific and have no counterpart in docx or xlsx.

---

### 2.5b — Decision matrix outcome

| Reference | Situation | Action |
|---|---|---|
| `scripts/office/` shared with docx, xlsx | Shared-code pattern (2.5c) — upstream design, each skill self-contained | **Do NOT declare as dependency.** Note in `notes:`. |
| `validators/docx.py` inside pptx/scripts/ | Self-contained copy within the skill package | Not a dependency — it's bundled. |
| `markitdown[pptx]`, `Pillow` | External Python packages | Add to `dependencies.external` |
| `pptxgenjs` | External npm package | Add to `dependencies.external` |
| `soffice` / LibreOffice | External system binary | Add to `dependencies.external` |

**Applying 2.5c (Shared-code pattern):**  
`scripts/office/` is identical across docx, xlsx, and pptx. This is upstream design — each skill is intentionally self-contained. We do **not** create a shared dependency or symlink. Instead, we add a note to the sidecar so future upgraders know to sync all three together.

---

### 2.5d — Source alignment check for existing claudekit skills

Since `pptx` has no inter-skill `dependencies.required`, Step 2.5d is not applicable. However, as a sanity check on the shared-code observation:

```bash
cat claudekit/skills/docx/SOURCE.yaml | grep "repo|commit"
cat claudekit/skills/xlsx/SOURCE.yaml | grep "repo|commit"
```

All three (`pptx`, `docx`, `xlsx`) share:
- `repo: https://github.com/anthropics/skills`
- `commit: d211d437443a7b2496a3dad9575e7dddd724c585`

**Same repo, same commit** → the shared `scripts/office/` copies are guaranteed identical. Future upgrades should sync all three together.

---

## Answer to the user's question

> **Do you need to pick docx and xlsx too?**

**No.** `pptx` is entirely self-contained:
- No references to `claudekit/skills/docx/` or `claudekit/skills/xlsx/` at runtime
- `scripts/office/` is a **bundled copy** inside the pptx skill — it doesn't import from docx or xlsx
- `validators/docx.py` inside `pptx/scripts/office/validators/` is a docx-format validator used by pptx's own `validate.py` to cross-validate; it's a self-contained copy, not a reference to the docx skill

You don't need to pick docx or xlsx as dependencies. However, because the three skills share identical `scripts/office/` code, **they should be upgraded together** whenever upstream changes that subtree.

---

## Step 4 — Sidecar (corrected SOURCE.yaml)

The existing `claudekit/skills/pptx/SOURCE.yaml` is missing the `dependencies.external` entries and the shared-code note. The corrected version:

```yaml
# yaml-language-server: $schema=../../../presets/schema/sidecar.schema.json
source:
  repo: https://github.com/anthropics/skills
  commit: d211d437443a7b2496a3dad9575e7dddd724c585
  path: skills/pptx
  ref: main
imported_at: "2026-05-08"
license: Proprietary
modified: false
modifications: null
notes: >-
  Create, read, edit, or manipulate .pptx files. Includes editing.md,
  pptxgenjs.md, and scripts/. scripts/office/ (pack, validate, unpack,
  soffice, validators/, helpers/, schemas/) is byte-for-byte identical to
  claudekit/skills/docx and claudekit/skills/xlsx at the same upstream
  commit — this is upstream design (self-contained). Sync all three together
  when upgrading. Proprietary Anthropic license — personal use only, do not
  redistribute.
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
    - name: python3
      type: system_binary
      reason: "scripts/*.py require Python 3.x"
    - name: markitdown
      type: python_pkg
      reason: "python -m markitdown for text extraction (pip install markitdown[pptx])"
    - name: Pillow
      type: python_pkg
      reason: "scripts/thumbnail.py for slide thumbnail grids"
    - name: pptxgenjs
      type: npm
      reason: "creating .pptx from scratch (npm install -g pptxgenjs)"
    - name: soffice
      type: system_binary
      reason: "scripts/office/soffice.py — PDF conversion via LibreOffice"
tags:
  - pptx
  - presentations
  - office
categories:
  purpose:
    - documents
  stack:
    - cross-stack
```

---

## Steps 3, 5–7

Since `pptx` is already vendored at the correct commit, no copy operation is needed. The only change is updating `SOURCE.yaml` with the corrected `dependencies.external` and `notes` as shown above. Run `pnpm typecheck` to verify.
