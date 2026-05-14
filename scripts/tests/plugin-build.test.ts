import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Preset, Sidecar } from '../lib/schema.ts';
import type { PlannedComponent, InstallPlan } from '../lib/resolver.ts';

vi.mock('../lib/resolver.ts');
vi.mock('node:fs/promises');

import * as resolverMod from '../lib/resolver.ts';
import * as fsMod from 'node:fs/promises';
import { buildPlugin } from '../lib/plugin-build.ts';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePreset(overrides: Partial<Preset> = {}): Preset {
  return {
    name: 'test-preset',
    kind: 'core',
    description: 'Test preset',
    version: '0.1.0',
    extends: [],
    components: {
      agents: [{ name: 'code-reviewer', source: 'everything-claude-code' as const }],
      skills: [],
      commands: [],
      hooks: [],
      rules: [],
    },
    settings_patch: {},
    external_setup: [],
    tags: ['baseline'],
    use_case_tags: { roles: [], project_types: [], stacks: [], use_cases: [] },
    ...overrides,
  };
}

function makeSidecar(): Sidecar {
  return {
    source: {
      repo: 'https://github.com/example/repo',
      commit: '0123456789abcdef0123456789abcdef01234567',
      path: 'agents/code-reviewer.md',
      ref: 'main',
    },
    imported_at: '2026-05-08',
    license: 'MIT',
    modified: false,
    modifications: null,
    notes: null,
    dependencies: {
      required: { agents: [], skills: [], commands: [], hooks: [], rules: [] },
      optional: { agents: [], skills: [], commands: [], hooks: [], rules: [] },
      external: [],
    },
    tags: [],
    categories: {},
  };
}

function makePlan(preset: Preset, components: PlannedComponent[]): InstallPlan {
  return {
    preset,
    all_presets: [preset],
    components,
    merged_settings_patch: {},
    external_warnings: [],
    dep_log: [],
  };
}

function makeFileComponent(type: PlannedComponent['type'], id: string): PlannedComponent {
  return {
    type,
    id,
    source: 'everything-claude-code',
    layout: {
      kind: 'file',
      componentPath: `/fake/claudekit/everything-claude-code/${type}/${id}.md`,
      sidecarPath: `/fake/claudekit/everything-claude-code/${type}/${id}.source.yaml`,
    },
    sidecar: makeSidecar(),
    source_commit: '0123456789abcdef0123456789abcdef01234567',
    auto_included: false,
    required_by: [],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildPlugin', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Stub out all fs operations to be no-ops.
    vi.mocked(fsMod.mkdir).mockResolvedValue(undefined);
    vi.mocked(fsMod.copyFile).mockResolvedValue(undefined);
    vi.mocked(fsMod.rm).mockResolvedValue(undefined);
    vi.mocked(fsMod.writeFile).mockResolvedValue(undefined);
    vi.mocked(fsMod.readdir).mockResolvedValue([]);
  });

  it('calls buildInstallPlan with preset name and options', async () => {
    const preset = makePreset();
    const plan = makePlan(preset, []);
    vi.mocked(resolverMod.buildInstallPlan).mockResolvedValue(plan);

    await buildPlugin('test-preset', { include_optional: true, kind: 'core' });

    expect(resolverMod.buildInstallPlan).toHaveBeenCalledWith('test-preset', {
      include_optional: true,
      kind: 'core',
    });
  });

  it('generates plugin.json with correct fields', async () => {
    const preset = makePreset({ tags: ['baseline', 'cross-stack'] });
    const components: PlannedComponent[] = [
      makeFileComponent('skills', 'coding-standards'),
      makeFileComponent('commands', 'tdd'),
    ];
    const plan = makePlan(preset, components);
    vi.mocked(resolverMod.buildInstallPlan).mockResolvedValue(plan);

    let writtenJson: string | undefined;
    vi.mocked(fsMod.writeFile).mockImplementation(async (_path, data) => {
      writtenJson = data as string;
    });

    await buildPlugin('test-preset', {
      outDir: '/tmp/test-plugin',
      author: { name: 'owner', email: 'owner@example.com' },
      license: 'MIT',
    });

    const manifest = JSON.parse(writtenJson ?? '{}');
    expect(manifest.name).toBe('test-preset');
    expect(manifest.version).toBe('0.1.0');
    expect(manifest.description).toBe('Test preset');
    expect(manifest.author).toEqual({ name: 'owner', email: 'owner@example.com' });
    expect(manifest.license).toBe('MIT');
    expect(manifest.keywords).toEqual(['baseline', 'cross-stack']);
    expect(manifest.mcpServers).toEqual({});
    expect(manifest.skills).toEqual(['./skills/']);
    expect(manifest.commands).toEqual(['./commands/']);
    expect(manifest.agents).toBeUndefined();
    expect(manifest.hooks).toBeUndefined();
  });

  it('omits skills/commands when no components of that type', async () => {
    const preset = makePreset();
    // Only agent — no skills or commands.
    const plan = makePlan(preset, [makeFileComponent('agents', 'code-reviewer')]);
    vi.mocked(resolverMod.buildInstallPlan).mockResolvedValue(plan);

    let writtenJson: string | undefined;
    vi.mocked(fsMod.writeFile).mockImplementation(async (_path, data) => {
      writtenJson = data as string;
    });

    await buildPlugin('test-preset', { outDir: '/tmp/test-plugin' });

    const manifest = JSON.parse(writtenJson ?? '{}');
    expect(manifest.skills).toBeUndefined();
    expect(manifest.commands).toBeUndefined();
  });

  it('cleans output dir when clean=true', async () => {
    const preset = makePreset();
    vi.mocked(resolverMod.buildInstallPlan).mockResolvedValue(makePlan(preset, []));

    await buildPlugin('test-preset', { outDir: '/tmp/test-plugin', clean: true });

    expect(fsMod.rm).toHaveBeenCalledWith('/tmp/test-plugin', { recursive: true, force: true });
  });

  it('does not clean output dir when clean=false', async () => {
    const preset = makePreset();
    vi.mocked(resolverMod.buildInstallPlan).mockResolvedValue(makePlan(preset, []));

    await buildPlugin('test-preset', { outDir: '/tmp/test-plugin', clean: false });

    expect(fsMod.rm).not.toHaveBeenCalled();
  });

  it('counts copied components and returns result', async () => {
    const preset = makePreset();
    const components: PlannedComponent[] = [
      makeFileComponent('agents', 'code-reviewer'),
      makeFileComponent('skills', 'coding-standards'),
    ];
    vi.mocked(resolverMod.buildInstallPlan).mockResolvedValue(makePlan(preset, components));

    const result = await buildPlugin('test-preset', { outDir: '/tmp/test-plugin' });

    expect(result.componentCount).toBe(2);
    expect(result.skipped).toHaveLength(0);
  });

  it('skips component and records error when copy fails', async () => {
    const preset = makePreset();
    const components: PlannedComponent[] = [makeFileComponent('agents', 'code-reviewer')];
    vi.mocked(resolverMod.buildInstallPlan).mockResolvedValue(makePlan(preset, components));

    vi.mocked(fsMod.copyFile).mockRejectedValue(new Error('ENOENT: file not found'));

    const result = await buildPlugin('test-preset', { outDir: '/tmp/test-plugin' });

    expect(result.componentCount).toBe(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toContain('agents:code-reviewer');
    expect(result.skipped[0]).toContain('ENOENT');
  });

  it('sets homepage and repository when provided', async () => {
    const preset = makePreset();
    vi.mocked(resolverMod.buildInstallPlan).mockResolvedValue(makePlan(preset, []));

    let writtenJson: string | undefined;
    vi.mocked(fsMod.writeFile).mockImplementation(async (_path, data) => {
      writtenJson = data as string;
    });

    await buildPlugin('test-preset', {
      outDir: '/tmp/test-plugin',
      homepage: 'https://example.com',
      repository: 'https://github.com/example/repo',
    });

    const manifest = JSON.parse(writtenJson ?? '{}');
    expect(manifest.homepage).toBe('https://example.com');
    expect(manifest.repository).toBe('https://github.com/example/repo');
  });
});
