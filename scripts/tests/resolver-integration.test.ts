import { describe, it, expect } from 'vitest';
import { buildInstallPlan } from '../lib/resolver.ts';

// Uses real claudekit/ and presets/ fixture files — no mocks.

describe('buildInstallPlan (integration — real fixtures)', () => {
  it('resolves developer: planner + tdd-workflow + extends ai-native', async () => {
    const plan = await buildInstallPlan('developer');
    expect(plan.preset.name).toBe('developer');
    expect(plan.all_presets.map((p) => p.name)).toContain('developer');

    const agentIds = plan.components.filter((c) => c.type === 'agents').map((c) => c.id);
    const skillIds = plan.components.filter((c) => c.type === 'skills').map((c) => c.id);
    expect(agentIds).toContain('planner');
    expect(skillIds).toContain('tdd-workflow');
  });
});
