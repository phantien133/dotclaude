import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadYaml } from '../lib/yaml.ts';
import { PresetSchema, SidecarSchema } from '../lib/schema.ts';

const REPO_ROOT = new URL('../..', import.meta.url).pathname;

describe('shipped fixtures parse against schema', () => {
  it('presets/core/developer/preset.yaml is valid', async () => {
    const raw = await readFile(
      join(REPO_ROOT, 'presets/core/developer/preset.yaml'),
      'utf8',
    );
    const data = loadYaml(raw);
    const parsed = PresetSchema.parse(data);
    expect(parsed.name).toBe('developer');
    expect(parsed.kind).toBe('core');
    expect(parsed.components.skills.map((s) => s.name)).toContain('tdd-workflow');
    expect(
      parsed.components.skills.find((s) => s.name === 'tdd-workflow')?.source,
    ).toBe('everything-claude-code');
  });

  it('claudekit/everything-claude-code/agents/code-reviewer.source.yaml is valid', async () => {
    const raw = await readFile(
      join(REPO_ROOT, 'claudekit/everything-claude-code/agents/code-reviewer.source.yaml'),
      'utf8',
    );
    const data = loadYaml(raw);
    const parsed = SidecarSchema.parse(data);
    expect(parsed.source.path).toBe('agents/code-reviewer.md');
    expect(parsed.dependencies.required.skills).toContain('coding-standards');
    expect(parsed.modified).toBe(false);
  });

  it('claudekit/everything-claude-code/skills/coding-standards/SOURCE.yaml is valid', async () => {
    const raw = await readFile(
      join(REPO_ROOT, 'claudekit/everything-claude-code/skills/coding-standards/SOURCE.yaml'),
      'utf8',
    );
    const data = loadYaml(raw);
    const parsed = SidecarSchema.parse(data);
    expect(parsed.source.path).toBe('skills/coding-standards/SKILL.md');
    expect(parsed.dependencies.required.skills).toEqual([]);
  });
});
