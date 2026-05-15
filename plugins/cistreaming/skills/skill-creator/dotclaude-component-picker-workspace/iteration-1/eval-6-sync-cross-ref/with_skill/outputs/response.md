# Sync: coding-standards from ECC + Cross-Reference Check

## Step 1 — Browse (upgrade mode)

The pinned commit in `claudekit/skills/coding-standards/SOURCE.yaml` is:
```
841beea45cb25ba51f29fa45b7e272938d19b80a
```

Current upstream HEAD:
```bash
git -C upstream/everything-claude-code rev-parse HEAD
# → 841beea45cb25ba51f29fa45b7e272938d19b80a
```

**Result: upstream HEAD == pinned commit. The submodule is already at the latest — no new upstream content to sync.**

The diff between claudekit and upstream is empty:
```bash
diff claudekit/skills/coding-standards/SKILL.md \
     upstream/everything-claude-code/skills/coding-standards/SKILL.md
# (no output — files are identical)
```

## Step 2.5 — Cross-Reference & Dependency Scan

Even though no upgrade is needed, I'll run the full scan to check whether the *current* upstream version has cross-references we should have captured when we first vendored it.

### 2.5a — Scan results

```bash
COMP=upstream/everything-claude-code/skills/coding-standards

# References to other skills/agents
grep -rni "skill\|agent\|use_skill\|invoke\|require\|depends" "$COMP/"
```

Hits in `SKILL.md`:
- **Line 15**: `Use \`rules/common/coding-style.md\` when you need the shortest reusable rule layer instead of a full skill walkthrough.`
- **Line 37**: `domain-specific framework guidance when a narrower ECC skill already exists`

The other hits are self-referential ("this skill", "Activate this skill") — not inter-component dependencies.

```bash
# Python imports → no scripts/ dir in coding-standards
# Shell scripts → none
# Shared subtrees → no scripts/ to compare
```

### 2.5b — Decision matrix for the reference found

**Reference: `rules/common/coding-style.md` (ECC upstream)**

| Check | Finding |
|---|---|
| Exists in upstream? | ✅ `upstream/everything-claude-code/rules/common/coding-style.md` — 80-line concise coding rule |
| Already in `claudekit/rules/`? | ❌ `claudekit/rules/` is empty |
| Nature of reference | **Optional** — the SKILL.md says "use coding-style.md *when you need the shortest reusable rule layer instead of a full skill walkthrough*". The skill works completely without it; it's a lighter alternative, not a runtime dependency. |

**Decision: `dependencies.optional`, not required. Propose vendoring.**

### Recommendation

The reference to `rules/common/coding-style.md` is an optional companion rule. `coding-standards` stands alone — this is a cross-reference to something the user *can* add for projects that want a lighter rule file instead of the full skill.

Two options:

**Option A — Vendor the rule now** (recommended if you use rules in any preset):
```bash
cp upstream/everything-claude-code/rules/common/coding-style.md claudekit/rules/coding-style.md
# Create sidecar:
cat > claudekit/rules/coding-style.source.yaml << 'EOF'
# yaml-language-server: $schema=../../presets/schema/sidecar.schema.json
source:
  repo: https://github.com/affaan-m/everything-claude-code
  commit: 841beea45cb25ba51f29fa45b7e272938d19b80a
  path: rules/common/coding-style.md
  ref: main
imported_at: "2026-05-08"
license: MIT
modified: false
modifications: null
notes: >-
  Concise coding-style rule (immutability, KISS, DRY, YAGNI, file organization).
  Lighter alternative to the coding-standards skill. Referenced optionally by
  the coding-standards skill as a drop-in rule layer.
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
  external: []
tags:
  - code-quality
  - standards
  - rules
categories:
  purpose:
    - review
    - guidance
  stack:
    - cross-stack
EOF
```

Then update `coding-standards/SOURCE.yaml` to note the optional dependency:
```yaml
dependencies:
  optional:
    rules:
      - coding-style   # lighter alternative mentioned in SKILL.md line 15
```

**Option B — Skip for now**, add a note to `coding-standards/SOURCE.yaml`:
```yaml
notes: >-
  Foundation skill for cross-project coding conventions. References
  rules/common/coding-style.md from ECC as an optional lighter alternative
  (not vendored yet — add to claudekit/rules/ if needed).
```

## Summary

| Finding | Status | Action |
|---|---|---|
| Upstream drift | None — commit matches | No sync needed |
| Diff vs local | Clean — files identical | No changes required |
| Cross-reference: `rules/common/coding-style.md` | Found — optional dependency | Vendor if rules are used in presets |
| Other inter-skill dependencies | None | — |

No mandatory dependencies were missed. The only actionable item is deciding whether to vendor `coding-style.md` as an optional rule. The `coding-standards` skill is safe as-is.
