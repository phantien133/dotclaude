import { describe, it, expect } from 'vitest';
import { buildInstallPlan } from '../lib/resolver.ts';

// Uses real claudekit/ and presets/ fixture files — no mocks.

describe('buildInstallPlan (integration — real fixtures)', () => {
  it('resolves personal-baseline: code-reviewer + auto-dep coding-standards', async () => {
    const plan = await buildInstallPlan('personal-baseline');
    expect(plan.preset.name).toBe('personal-baseline');
    expect(plan.all_presets.map((p) => p.name)).toEqual(['personal-baseline']);

    const agentIds = plan.components.filter((c) => c.type === 'agents').map((c) => c.id);
    const skillIds = plan.components.filter((c) => c.type === 'skills').map((c) => c.id);
    expect(agentIds).toContain('code-reviewer');
    expect(skillIds).toContain('coding-standards');

    const agent = plan.components.find((c) => c.id === 'code-reviewer');
    const skill = plan.components.find((c) => c.id === 'coding-standards');
    expect(agent?.auto_included).toBe(false);
    expect(skill?.auto_included).toBe(true);
    expect(skill?.required_by).toContain('agents:code-reviewer');
    expect(plan.merged_settings_patch).toEqual({});
  });
});
