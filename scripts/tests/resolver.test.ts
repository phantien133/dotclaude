import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Preset, Sidecar, ClaudekitSource } from '../lib/schema.ts';

// Tests use a fixed source alias — paths are faked through mocks anyway.
const TEST_SOURCE: ClaudekitSource = 'dotclaude-self';
const ref = (name: string) => ({ name, source: TEST_SOURCE });

vi.mock('../lib/preset.ts');
vi.mock('../lib/sidecar.ts');

import * as presetMod from '../lib/preset.ts';
import * as sidecarMod from '../lib/sidecar.ts';
import { resolveExtends, mergeSettingsPatches, buildInstallPlan } from '../lib/resolver.ts';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePreset(name: string, opts: {
  extends?: string[];
  components?: Partial<Preset['components']>;
  settings_patch?: Record<string, unknown>;
} = {}): Preset {
  return {
    name,
    kind: 'core',
    description: `${name} preset`,
    version: '0.1.0',
    extends: opts.extends ?? [],
    components: {
      agents: [],
      skills: [],
      commands: [],
      hooks: [],
      rules: [],
      ...opts.components,
    },
    settings_patch: opts.settings_patch ?? {},
    external_setup: [],
    use_case_tags: { roles: [], project_types: [], stacks: [], use_cases: [] },
    tags: [],
  };
}

const BASE_SOURCE = {
  repo: 'https://github.com/example/repo',
  commit: '0123456789abcdef0123456789abcdef01234567',
  path: 'agents/x.md',
  ref: 'main',
};

function makeSidecar(opts: { required?: Partial<Sidecar['dependencies']['required']> } = {}): Sidecar {
  const empty = { agents: [], skills: [], commands: [], hooks: [], rules: [] };
  return {
    source: BASE_SOURCE,
    imported_at: '2026-05-08',
    license: 'MIT',
    modified: false,
    modifications: null,
    notes: null,
    dependencies: {
      required: { ...empty, ...opts.required },
      optional: { ...empty },
      external: [],
    },
    tags: [],
    categories: {},
  };
}

type LocatePresetFn = typeof presetMod.locatePreset;
type LocateComponentFn = typeof sidecarMod.locateComponent;
type LoadSidecarFn = typeof sidecarMod.loadSidecar;

function mockLocatePreset(map: Record<string, Preset>): void {
  vi.mocked<LocatePresetFn>(presetMod.locatePreset).mockImplementation(
    async (name: string) => {
      const preset = map[name];
      if (!preset) throw new Error(`Preset "${name}" not found`);
      return { preset, scope: 'public', presetDir: `/fake/${name}`, yamlPath: `/fake/${name}/preset.yaml`, mdPath: null };
    },
  );
}

function mockLocateComponent(
  map: Record<string, { kind: 'file'; path: string } | { kind: 'folder'; path: string }>,
): void {
  vi.mocked<LocateComponentFn>(sidecarMod.locateComponent).mockImplementation(
    async (input: { type: string; id: string; source?: ClaudekitSource }) => {
      const key = `${input.type}:${input.id}`;
      const entry = map[key];
      if (!entry) return null;
      if (entry.kind === 'folder') {
        return {
          source: input.source ?? TEST_SOURCE,
          layout: {
            kind: 'folder',
            componentPath: entry.path,
            sidecarPath: `${entry.path}/SOURCE.yaml`,
          },
        };
      }
      return {
        source: input.source ?? TEST_SOURCE,
        layout: {
          kind: 'file',
          componentPath: `${entry.path}.md`,
          sidecarPath: `${entry.path}.source.yaml`,
        },
      };
    },
  );
}

function mockLoadSidecar(map: Record<string, Sidecar>): void {
  vi.mocked<LoadSidecarFn>(sidecarMod.loadSidecar).mockImplementation(
    async (path: string) => {
      const sidecar = map[path];
      if (!sidecar) throw new Error(`No sidecar at ${path}`);
      return sidecar;
    },
  );
}

// ── resolveExtends ────────────────────────────────────────────────────────────

describe('resolveExtends', () => {
  beforeEach(() => vi.clearAllMocks());

  it('single preset with no extends returns just that preset', async () => {
    const pA = makePreset('a');
    mockLocatePreset({ a: pA });
    const result = await resolveExtends(pA);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('a');
  });

  it('linear chain: C extends B extends A → [A, B, C]', async () => {
    const pA = makePreset('a');
    const pB = makePreset('b', { extends: ['a'] });
    const pC = makePreset('c', { extends: ['b'] });
    mockLocatePreset({ a: pA, b: pB, c: pC });
    const result = await resolveExtends(pC);
    expect(result.map((p) => p.name)).toEqual(['a', 'b', 'c']);
  });

  it('diamond: A extends B and C, both extend D → D appears once', async () => {
    const pD = makePreset('d');
    const pB = makePreset('b', { extends: ['d'] });
    const pC = makePreset('c', { extends: ['d'] });
    const pA = makePreset('a', { extends: ['b', 'c'] });
    mockLocatePreset({ a: pA, b: pB, c: pC, d: pD });
    const result = await resolveExtends(pA);
    const names = result.map((p) => p.name);
    expect(names.filter((n) => n === 'd')).toHaveLength(1);
    expect(names).toContain('a');
    expect(names).toContain('b');
    expect(names).toContain('c');
    expect(names.indexOf('d')).toBeLessThan(names.indexOf('b'));
    expect(names.indexOf('d')).toBeLessThan(names.indexOf('c'));
  });

  it('circular extends throws', async () => {
    const pA = makePreset('a', { extends: ['b'] });
    const pB = makePreset('b', { extends: ['a'] });
    mockLocatePreset({ a: pA, b: pB });
    await expect(resolveExtends(pA)).rejects.toThrow(/[Cc]ircular/);
  });

  it('self-referential extends throws', async () => {
    const pA = makePreset('a', { extends: ['a'] });
    mockLocatePreset({ a: pA });
    await expect(resolveExtends(pA)).rejects.toThrow(/[Cc]ircular/);
  });
});

// ── mergeSettingsPatches ──────────────────────────────────────────────────────

describe('mergeSettingsPatches', () => {
  it('empty patches return empty object', () => {
    expect(mergeSettingsPatches([])).toEqual({});
    expect(mergeSettingsPatches([makePreset('a')])).toEqual({});
  });

  it('nested object merge', () => {
    const p1 = makePreset('a', { settings_patch: { foo: { x: 1 } } });
    const p2 = makePreset('b', { settings_patch: { foo: { y: 2 } } });
    const result = mergeSettingsPatches([p1, p2]);
    expect(result).toEqual({ foo: { x: 1, y: 2 } });
  });

  it('arrays are concatenated', () => {
    const p1 = makePreset('a', { settings_patch: { hooks: ['a', 'b'] } });
    const p2 = makePreset('b', { settings_patch: { hooks: ['c'] } });
    const result = mergeSettingsPatches([p1, p2]);
    expect(result['hooks']).toEqual(['a', 'b', 'c']);
  });

  it('scalar conflict: later preset wins', () => {
    const p1 = makePreset('a', { settings_patch: { key: 'first' } });
    const p2 = makePreset('b', { settings_patch: { key: 'second' } });
    const result = mergeSettingsPatches([p1, p2]);
    expect(result['key']).toBe('second');
  });

  it('later preset does not clobber keys not in its patch', () => {
    const p1 = makePreset('a', { settings_patch: { x: 1, y: 2 } });
    const p2 = makePreset('b', { settings_patch: { y: 99 } });
    const result = mergeSettingsPatches([p1, p2]);
    expect(result['x']).toBe(1);
    expect(result['y']).toBe(99);
  });
});

// ── buildInstallPlan ─────────────────────────────────────────────────────────

describe('buildInstallPlan (mocked)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preset with no components returns empty plan', async () => {
    const pA = makePreset('a');
    mockLocatePreset({ a: pA });
    mockLocateComponent({});
    mockLoadSidecar({});

    const plan = await buildInstallPlan('a');
    expect(plan.components).toHaveLength(0);
    expect(plan.all_presets.map((p) => p.name)).toEqual(['a']);
    expect(plan.merged_settings_patch).toEqual({});
  });

  it('required dep auto-included with auto_included=true', async () => {
    const pA = makePreset('a', { components: { agents: [ref('agent-a')] } });
    mockLocatePreset({ a: pA });
    mockLocateComponent({
      'agents:agent-a': { kind: 'file', path: '/fake/claudekit/agents/agent-a' },
      'skills:skill-x': { kind: 'folder', path: '/fake/claudekit/skills/skill-x' },
    });
    mockLoadSidecar({
      '/fake/claudekit/agents/agent-a.source.yaml': makeSidecar({ required: { skills: ['skill-x'] } }),
      '/fake/claudekit/skills/skill-x/SOURCE.yaml': makeSidecar(),
    });

    const plan = await buildInstallPlan('a');
    expect(plan.components).toHaveLength(2);
    const agentA = plan.components.find((c) => c.id === 'agent-a');
    const skillX = plan.components.find((c) => c.id === 'skill-x');
    expect(agentA?.auto_included).toBe(false);
    expect(skillX?.auto_included).toBe(true);
    expect(skillX?.required_by).toContain('agents:agent-a');
  });

  it('optional dep skipped by default when missing', async () => {
    const sidecarWithOptional: Sidecar = {
      ...makeSidecar(),
      dependencies: {
        required: { agents: [], skills: [], commands: [], hooks: [], rules: [] },
        optional: { agents: [], skills: ['opt-skill'], commands: [], hooks: [], rules: [] },
        external: [],
      },
    };
    const pA = makePreset('a', { components: { agents: [ref('agent-a')] } });
    mockLocatePreset({ a: pA });
    mockLocateComponent({
      'agents:agent-a': { kind: 'file', path: '/fake/claudekit/agents/agent-a' },
      // opt-skill NOT in map → not found
    });
    mockLoadSidecar({
      '/fake/claudekit/agents/agent-a.source.yaml': sidecarWithOptional,
    });

    const plan = await buildInstallPlan('a');
    expect(plan.components).toHaveLength(1);
    expect(plan.components[0]?.id).toBe('agent-a');
  });

  it('optional dep included when include_optional=true', async () => {
    const sidecarWithOptional: Sidecar = {
      ...makeSidecar(),
      dependencies: {
        required: { agents: [], skills: [], commands: [], hooks: [], rules: [] },
        optional: { agents: [], skills: ['opt-skill'], commands: [], hooks: [], rules: [] },
        external: [],
      },
    };
    const pA = makePreset('a', { components: { agents: [ref('agent-a')] } });
    mockLocatePreset({ a: pA });
    mockLocateComponent({
      'agents:agent-a': { kind: 'file', path: '/fake/claudekit/agents/agent-a' },
      'skills:opt-skill': { kind: 'folder', path: '/fake/claudekit/skills/opt-skill' },
    });
    mockLoadSidecar({
      '/fake/claudekit/agents/agent-a.source.yaml': sidecarWithOptional,
      '/fake/claudekit/skills/opt-skill/SOURCE.yaml': makeSidecar(),
    });

    const plan = await buildInstallPlan('a', { include_optional: true });
    expect(plan.components).toHaveLength(2);
  });

  it('missing required component throws', async () => {
    const pA = makePreset('a', { components: { agents: [ref('missing-agent')] } });
    mockLocatePreset({ a: pA });
    mockLocateComponent({});
    mockLoadSidecar({});

    await expect(buildInstallPlan('a')).rejects.toThrow(/not found/);
  });

  it('required dep not found throws', async () => {
    const pA = makePreset('a', { components: { agents: [ref('agent-a')] } });
    mockLocatePreset({ a: pA });
    mockLocateComponent({
      'agents:agent-a': { kind: 'file', path: '/fake/claudekit/agents/agent-a' },
      // dep-skill NOT in map
    });
    mockLoadSidecar({
      '/fake/claudekit/agents/agent-a.source.yaml': makeSidecar({ required: { skills: ['dep-skill'] } }),
    });

    await expect(buildInstallPlan('a')).rejects.toThrow(/not found/);
  });

  it('circular component deps do not loop infinitely', async () => {
    const sidecarA = makeSidecar({ required: { skills: ['skill-b'] } });
    const sidecarB = makeSidecar({ required: { agents: ['agent-a'] } });
    const pA = makePreset('a', { components: { agents: [ref('agent-a')] } });
    mockLocatePreset({ a: pA });
    mockLocateComponent({
      'agents:agent-a': { kind: 'file', path: '/fake/claudekit/agents/agent-a' },
      'skills:skill-b': { kind: 'folder', path: '/fake/claudekit/skills/skill-b' },
    });
    mockLoadSidecar({
      '/fake/claudekit/agents/agent-a.source.yaml': sidecarA,
      '/fake/claudekit/skills/skill-b/SOURCE.yaml': sidecarB,
    });

    const plan = await buildInstallPlan('a');
    // Should resolve without infinite loop; both components present
    expect(plan.components.map((c) => c.id).sort()).toEqual(['agent-a', 'skill-b']);
  });

  it('diamond deps: same dep from two components appears once', async () => {
    const sharedSidecar = makeSidecar();
    const pA = makePreset('a', { components: { agents: [ref('agent-1'), ref('agent-2')] } });
    mockLocatePreset({ a: pA });
    mockLocateComponent({
      'agents:agent-1': { kind: 'file', path: '/fake/claudekit/agents/agent-1' },
      'agents:agent-2': { kind: 'file', path: '/fake/claudekit/agents/agent-2' },
      'skills:shared': { kind: 'folder', path: '/fake/claudekit/skills/shared' },
    });
    mockLoadSidecar({
      '/fake/claudekit/agents/agent-1.source.yaml': makeSidecar({ required: { skills: ['shared'] } }),
      '/fake/claudekit/agents/agent-2.source.yaml': makeSidecar({ required: { skills: ['shared'] } }),
      '/fake/claudekit/skills/shared/SOURCE.yaml': sharedSidecar,
    });

    const plan = await buildInstallPlan('a');
    const sharedComponents = plan.components.filter((c) => c.id === 'shared');
    expect(sharedComponents).toHaveLength(1);
    // required_by should contain both agents
    expect(sharedComponents[0]?.required_by).toContain('agents:agent-1');
    expect(sharedComponents[0]?.required_by).toContain('agents:agent-2');
  });
});

