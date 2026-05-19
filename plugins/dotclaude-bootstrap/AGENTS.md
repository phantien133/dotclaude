# Dotclaude Bootstrap — Agent Instructions

Bootstrap preset for new dotclaude users — setup wizard, preset creation wizard, debugger, and external plugin discovery.

**Version:** 0.1.0

## Core Principles

1. **Wizard-first** — use `/dotclaude-setup` or `/preset-wizard` before doing anything manually
2. **Plan before execute** — think through preset requirements before writing YAML
3. **Debug with skills** — use `preset-debugger` skill when a preset build or install fails
4. **Discover before building** — use `plugin-discovery` to find existing components before authoring new ones

## Available Agents

This preset does not install specialized agents. Agents are added by the `developer` chain when users install more complete presets.

## Agent Orchestration

No agents bundled in this preset. If agents are available from inheriting presets, use them proactively without waiting for the user to ask.

## Security Guidelines

**Before ANY commit:**
- No hardcoded secrets (API keys, passwords, tokens)
- All user inputs validated at system boundaries
- Error messages do not leak sensitive data

## Coding Style

- **preset-debugger**: Diagnoses and fixes broken presets or plugin build failures
- **plugin-discovery**: Searches GitHub for external components to vendor into claudekit
- `/dotclaude-setup`: Wizard to bootstrap a new Claude Code install from dotclaude
- `/preset-wizard`: Interactive wizard to create a new dotclaude preset from scratch
