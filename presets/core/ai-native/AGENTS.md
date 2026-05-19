# AI-Native — Agent Instructions

Extends core with AI self-learning and skill creation — for users who want Claude to improve with their personal workflow over time.

**Version:** 0.1.0

## Core Principles

1. **Plan before execute** — think through requirements before writing code
2. **Agent-first** — delegate domain tasks to specialized agents when available
3. **Learn continuously** — observe patterns, capture instincts, evolve skills over time
4. **Skill-first** — new workflow knowledge goes into skills, not one-off instructions

## Available Agents

This preset does not install specialized agents. Agents are added by inheriting presets (`developer` and framework presets).

## Agent Orchestration

No agents bundled in this preset. If agents are available from inheriting presets, use them proactively without waiting for the user to ask.

## Security Guidelines

**Before ANY commit:**
- No hardcoded secrets (API keys, passwords, tokens)
- All user inputs validated at system boundaries
- Error messages do not leak sensitive data

**If a security issue is found:** STOP → fix CRITICAL issues → rotate any exposed secrets.

## Coding Style

- **continuous-learning-v2**: Session observation that captures reusable workflow instincts
- **skill-creator**: Generates new skills from git history and session patterns
- **ai-regression-testing**: Validates that evolved skills don't regress on existing workflows
