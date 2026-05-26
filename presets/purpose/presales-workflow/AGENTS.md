# Presales Workflow — Agent Instructions

Pre-sales developer workflow for ingesting client documents, researching requirements, breaking down tasks, and producing estimation templates and proposals.

**Version:** 0.1.0

## Core Principles

1. **Document-driven** — anchor every estimate, proposal, and risk item to a specific source document (Capability Map, SOW, RFP). Never estimate from memory alone.
2. **Research-first** — gather web evidence (via Tavily or `mgrep --web`) before making technology recommendations or comparisons.
3. **Plan before execute** — invoke the `planner` agent for any requirement breakdown with more than 3 work items; do not estimate directly from raw intake.
4. **Structured estimation** — xlsx templates must use Excel formulas, not hardcoded values, so estimates recalculate when assumptions change.
5. **Agent-first** — delegate document analysis, research synthesis, and planning to specialized agents; do not do all work inline.
6. **Reader-test proposals** — run the `doc-coauthoring` reader-test stage before finalizing any SOW or proposal to catch blind spots.

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `planner` | Break down requirements into phased tasks with dependencies, risks, and complexity estimates | Any client requirement with >3 deliverables; effort estimation; risk planning |
| `code-architect` | Design solution architecture from requirements | When client SOW requires a technical solution design |
| `code-explorer` | Analyze existing codebases or vendor repos | When researching an existing system the client uses |
| `code-reviewer` | Review code quality, security, and maintainability | When evaluating vendor code or client-provided scripts |
| `code-simplifier` | Simplify and refine code or document structure | When cleaning up estimation scripts or template logic |

## Agent Orchestration

Use agents **proactively without waiting for the user to ask**:

- Client document intake (PDF/xlsx/Word) → read and extract → **planner** to break down requirements
- Effort estimation requested → **planner** to produce phased breakdown with risk flags
- Technology recommendation needed → research via `mgrep --web` or Tavily → **planner** for implementation approach
- SOW or proposal draft → **doc-coauthoring** skill (interactive stages) → reader-test with sub-agent
- Vendor or competitor research → `mgrep --web` or Tavily → synthesize findings → **knowledge-ops** to save

Use parallel agents for independent research sub-questions — launch multiple agents simultaneously when sub-tasks do not depend on each other.

## Document Intake Workflow

When the user provides a client document (PDF, xlsx, Word):

1. Identify document type: Capability Map / SOW / RFP / estimation template / other
2. Extract key sections: requirements, constraints, timeline, budget signals, open questions
3. Summarize findings in structured form before proceeding
4. Invoke **planner** to break requirements into task phases with risk assessment
5. Use **knowledge-ops** to save extracted requirements and research findings for future sessions

## Estimation Guidelines

- Always work from the xlsx templates in the project — never estimate in plain text
- Use the `xlsx` skill to create or modify estimation templates; keep formulas dynamic
- Break work into: Discovery, Design, Development, Testing, Deployment, Handover
- Flag every assumption as a risk item in the planner output
- Risk classification: Low (well-understood, standard), Medium (dependencies or unknowns), High (new technology or unclear scope)

## Security Guidelines

**Before ANY document or file operation:**
- Do not write client data to files outside the project directory
- Do not commit files containing client PII or confidential data to git
- Redact sensitive information (API keys, passwords, personal data) before saving to knowledge base
- If a client document contains credentials or secrets, flag immediately and do not store them

**If sensitive data is found in a document:** STOP → alert the user → handle per their data policy.

## Coding Style

- **xlsx**: Use Excel formulas for all calculations — never hardcode computed values; keep templates dynamic and recalculable
- **pdf**: Prefer `pdfplumber` for table extraction, `pypdf` for text; use OCR only when the PDF is scanned
- **docx**: Use `pandoc` for reading, `docx-js` for creating new documents with proper structure
- **knowledge-ops**: Use consistent kebab-case filenames; always add YAML frontmatter with type and date
