---
description: Lightweight workflow for bug fixes and small changes (1-3 files, <2h). Intake → Fix → Commit + Docs → PR.
argument-hint: <ticket-url-or-description>
allowed-tools: Bash, Read, Write, Edit, Skill, mcp__plane__retrieve_work_item_by_identifier, mcp__plane__retrieve_work_item, mcp__plane__search_work_items
---

# quick-fix

Lightweight dev workflow for bug fixes and small changes on the Hilab streaming platform.

**Use this when:** 1–3 files affected, no DB schema changes, no new API surface, estimated <2h.
**Use `/dev-task` instead when:** new feature, cross-module changes, DB migrations, new GraphQL operations.

**First run:** `$ARGUMENTS` is a Plane ticket URL, ticket identifier, or free description → starts Phase 0.
**Subsequent runs:** `$ARGUMENTS` is empty or `continue` → reads `state.yaml` and advances.

State: `streaming-docs/workflow/<task-slug>/state.yaml`
Docs:  `streaming-docs/workflow/<task-slug>/`

---

## ⚠️ Invocation gate — read this first on every run

**The workflow advances ONLY when the developer explicitly runs `/quick-fix`.**

- During a gate pause, the developer may freely chat, ask questions, or request edits — **do NOT advance the phase**.
- A phase transition happens **only** at the moment this skill is invoked with empty / `continue` args.
- If `$ARGUMENTS` is anything other than empty / `continue` / a URL / a description, treat it as a question within the current phase — respond and stay put.
- Never infer "the developer is done" from context. Wait for the explicit `/quick-fix` signal.

**Decision tree on each invocation:**

```
$ARGUMENTS present and looks like a URL, identifier, or description?
  └─ Yes → First run: start Phase 0
  └─ No (empty or "continue") →
       state.yaml exists?
         └─ No  → Ask for ticket URL or description (no state to resume)
         └─ Yes → Read phase + status, advance to next phase
```

---

## Phase 0 — Intake & Locate (INTERACTIVE → GATE 0)

1. Determine input type from `$ARGUMENTS`:
   - **Plane URL** (`pm.hilab.cloud/.../browse/<IDENTIFIER>/`): extract identifier, call `mcp__plane__retrieve_work_item_by_identifier` to fetch title + description.
   - **Plane identifier** (e.g. `CISTREAMIN-42`): same MCP call.
   - **Free description**: use as-is; no MCP call.
   - If MCP unavailable: proceed with the description provided.

2. Derive `task-slug`:
   - Plane ticket: `<IDENTIFIER>-<short-slug>` (kebab-case, max 25 chars for the title part)
   - Free description: kebab-case, max 40 chars, no prefix.

   Create directory `streaming-docs/workflow/<task-slug>/`.

3. **Locate affected files** — targeted search only (not a full module scan):
   - Parse description/title for file names, function names, class names, error strings
   - Grep for relevant identifiers in `streaming-api/src/` and `streaming-web/src/`
   - Read only the specific files implicated (max 5 files at this stage)
   - Form a root cause hypothesis

4. **Scope check** — if you discover any of the following, stop and recommend `/dev-task`:
   - DB schema changes needed
   - New GraphQL operations required
   - Changes span >3 files or >2 modules
   - Estimated implementation time >2h

5. Write `intake.md`:
   ```
   # Quick Fix — <title>

   ## Source
   - Input: <URL / identifier / "free description">
   - Ticket ID: <ID or n/a>

   ## Description
   <description>

   ## Root Cause Hypothesis
   <what is wrong and why>

   ## Affected Files
   - `<path>` — <reason>

   ## Approach
   <one-paragraph: what to change and how>

   ## Module
   <module name>
   ```

6. **PAUSE** — display summary card:
   ```
   Root cause: <hypothesis>
   Files:      <list>
   Approach:   <one-line summary>

   Confirm or correct (reply in chat), then run /quick-fix to implement.
   ```

7. Write `state.yaml`:
   ```yaml
   task: <task-slug>
   phase: "0"
   status: gate_pending
   module: <module>
   ```

**GATE 0:** developer confirms or corrects in chat, then runs `/quick-fix`.
- On next invocation: read developer's reply, update `intake.md` if needed, proceed to Phase 1.

---

## Phase 1 — Fix (AUTO → GATE 1)

*Runs when `state.yaml` shows `phase: "0"` + `status: gate_pending`.*

1. Read developer's reply from GATE 0. Update `intake.md § Affected Files` and `§ Approach` if changed.

2. **Implement the fix** — edit only files listed in `intake.md § Affected Files`.

3. **Run existing tests** — only if test files already exist for the affected module (do not write new tests):
   ```
   cd streaming-api && npx jest --testPathPattern=<module> --passWithNoTests
   ```

4. **Inline checks** on affected files:
   - Typecheck: `cd streaming-api && npx tsc --noEmit` (and `streaming-web` if web files changed)
   - Lint: `cd streaming-api && npx eslint <affected-file-paths>`

5. Write `fix.md`:
   ```
   # Fix — <title>

   ## Changes
   | File | What changed |
   |------|-------------|
   | <path> | <one-line summary> |

   ## Test results
   <PASS / FAIL / no tests found — include relevant output snippet>

   ## Check results
   | Check     | Result |
   |-----------|--------|
   | typecheck | ✅ / ❌ |
   | lint      | ✅ / ❌ |
   ```

6. Update `state.yaml`: `phase: "1"`, `status: gate_pending`

Output: Say "Fix implemented. Review the diff and fix.md. Run `/quick-fix` to commit."

**GATE 1:** developer reviews diff + fix.md, runs `/quick-fix`.

---

## Phase 2 — Commit & Docs (AUTO → GATE 2)

*Runs when `state.yaml` shows `phase: "1"` + `status: gate_pending`.*

1. **Commit** — stage only files from `intake.md § Affected Files`:
   ```
   git add <affected files>
   git commit -m "fix(<module>): <one-line summary from intake.md>"
   ```
   Do NOT use `git add -A`.

2. **Assess doc update need** — update only if meaningful:

   | Situation | Action |
   |-----------|--------|
   | Bug was in a named feature (sign-up, oauth, chat, etc.) | Append row to `features/<feature-name>.md § Implementation history` |
   | Fix changes behaviour listed as ✅ in module README | Update README § Implementation Status note |
   | Refactor / config tweak with no visible behaviour change | No doc update needed |
   | Truly trivial (typo, log message, comment) | No doc update needed |

   If ambiguous, ask the developer: "Worth a note in module docs? (y/n)"

3. Update `state.yaml`: `phase: "2"`, `status: gate_pending`

Output: Say "Committed. Doc updates done (if any). Review, then run `/quick-fix` to create the PR."

**GATE 2:** developer confirms, runs `/quick-fix`.

---

## Phase 3 — PR

*Runs when `state.yaml` shows `phase: "2"` + `status: gate_pending`.*

1. Invoke `create-pr` (uses `intake.md` as PR description base)
2. Write `pr.md` with PR link + post-merge checklist
3. Update `state.yaml`: `status: complete`

Output: PR link in `pr.md`. Say "PR created."

---

## State transitions summary

Every phase change requires an explicit `/quick-fix` invocation.

| phase | status       | Next `/quick-fix` triggers               |
|-------|-------------|------------------------------------------|
| "0"   | gate_pending | Phase 1 — implement fix                  |
| "1"   | gate_pending | Phase 2 — commit + doc update            |
| "2"   | gate_pending | Phase 3 — create PR → complete           |

---

## Escalation to /dev-task

Recommend switching to `/dev-task` (and stop this workflow) if at any phase you discover:
- DB schema changes are needed
- New GraphQL operations are required
- Changes span >3 files or >2 modules
- Estimated time exceeds 2h

Say: "This has grown beyond quick-fix scope. Run `/dev-task <description>` to restart with the full workflow."
