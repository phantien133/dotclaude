# Core — Agent Instructions

Universal baseline for any Claude Code user — context management, productivity, and semantic search.

**Version:** 0.1.0

## Core Principles

1. **Plan before execute** — think through requirements before writing code
2. **Agent-first** — delegate domain tasks to specialized agents when available
3. **Context-aware** — monitor context window size; compact before it degrades
4. **Documentation matters** — write docs co-authored with the user, not as afterthoughts

## Available Agents

This preset does not install specialized agents. Agents are added by inheriting presets (`ai-native`, `developer`, and framework presets).

## Agent Orchestration

This is the baseline preset — no agents are bundled here. If agents are available from inheriting presets, use them proactively without waiting for the user to ask.

## Security Guidelines

**Before ANY commit:**
- No hardcoded secrets (API keys, passwords, tokens)
- All user inputs validated at system boundaries
- Error messages do not leak sensitive data

**If a security issue is found:** STOP → fix CRITICAL issues → rotate any exposed secrets.

## Coding Style

- **doc-coauthoring**: Structured workflow for writing docs, proposals, and specs collaboratively
