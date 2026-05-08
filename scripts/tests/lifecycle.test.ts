import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, mkdtemp, readFile, rm as rmFs, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { uninstallPreset, upgradePreset, auditTarget } from '../lib/lifecycle.ts';
import type { Manifest } from '../lib/schema.ts';
import { writeManifest } from '../lib/manifest.ts';

function makeManifest(partial: Partial<Manifest> = {}): Manifest {
  return {
    schema_version: 1,
    installed_at: '2026-05-08T10:00:00.000Z',
    presets: [],
    components: [],
    settings_patches: [],
    external_deps: [],
    ...partial,
  };
}

function makeComponent(
  override: Partial<Manifest['components'][number]> = {},
): Manifest['components'][number] {
  return {
    type: 'agent',
    id: 'code-reviewer',
    target_path: '/tmp/agents/code-reviewer.md',
    mode: 'copy',
    source_path: '/src/agents/code-reviewer.md',
    source_commit: null,
    preset: 'my-preset',
    auto_included: false,
    required_by: [],
    ...override,
  };
}

// ── uninstallPreset ───────────────────────────────────────────────────────────

describe('uninstallPreset', () => {
  let targetRoot: string;

  beforeEach(async () => {
    targetRoot = await mkdtemp(join(tmpdir(), 'dotclaude-uninstall-'));
    await mkdir(join(targetRoot, 'agents'), { recursive: true });
    await mkdir(join(targetRoot, 'skills'), { recursive: true });
  });

  afterEach(async () => {
    await rmFs(targetRoot, { recursive: true, force: true });
  });

  it('throws when no manifest exists', async () => {
    await expect(uninstallPreset('my-preset', targetRoot)).rejects.toThrow('No manifest');
  });

  it('throws when preset is not in the manifest', async () => {
    const manifest = makeManifest({
      presets: [{ name: 'other', version: '1.0.0', kind: 'core' }],
    });
    await writeManifest(join(targetRoot, '.dotclaude-manifest.yaml'), manifest);
    await expect(uninstallPreset('my-preset', targetRoot)).rejects.toThrow('not installed');
  });

  it('dry-run: returns removed list without modifying FS or manifest', async () => {
    const agentPath = join(targetRoot, 'agents', 'code-reviewer.md');
    await writeFile(agentPath, '# code-reviewer');

    const manifest = makeManifest({
      presets: [{ name: 'my-preset', version: '1.0.0', kind: 'core' }],
      components: [makeComponent({ target_path: agentPath })],
    });
    await writeManifest(join(targetRoot, '.dotclaude-manifest.yaml'), manifest);

    const result = await uninstallPreset('my-preset', targetRoot, { dryRun: true });

    expect(result.removed).toEqual(['agent:code-reviewer']);
    // File must still exist (dry-run made no FS changes).
    await expect(readFile(agentPath)).resolves.toBeTruthy();
    // Manifest must still list the preset.
    const raw = await readFile(join(targetRoot, '.dotclaude-manifest.yaml'), 'utf8');
    expect(raw).toContain('my-preset');
  });

  it('removes component files and strips preset from manifest', async () => {
    const agentPath = join(targetRoot, 'agents', 'code-reviewer.md');
    await writeFile(agentPath, '# code-reviewer');

    const manifest = makeManifest({
      presets: [{ name: 'my-preset', version: '1.0.0', kind: 'core' }],
      components: [makeComponent({ target_path: agentPath })],
    });
    await writeManifest(join(targetRoot, '.dotclaude-manifest.yaml'), manifest);

    const result = await uninstallPreset('my-preset', targetRoot);

    expect(result.removed).toEqual(['agent:code-reviewer']);
    await expect(access(agentPath)).rejects.toThrow();
    const raw = await readFile(join(targetRoot, '.dotclaude-manifest.yaml'), 'utf8');
    expect(raw).not.toContain('my-preset');
    expect(raw).not.toContain('code-reviewer');
  });

  it('keeps components owned by other presets', async () => {
    const agentPath1 = join(targetRoot, 'agents', 'code-reviewer.md');
    const agentPath2 = join(targetRoot, 'agents', 'other-agent.md');
    await writeFile(agentPath1, '# code-reviewer');
    await writeFile(agentPath2, '# other-agent');

    const manifest = makeManifest({
      presets: [
        { name: 'my-preset', version: '1.0.0', kind: 'core' },
        { name: 'other-preset', version: '1.0.0', kind: 'core' },
      ],
      components: [
        makeComponent({ id: 'code-reviewer', target_path: agentPath1, preset: 'my-preset' }),
        makeComponent({ id: 'other-agent', target_path: agentPath2, preset: 'other-preset' }),
      ],
    });
    await writeManifest(join(targetRoot, '.dotclaude-manifest.yaml'), manifest);

    const result = await uninstallPreset('my-preset', targetRoot);

    expect(result.removed).toEqual(['agent:code-reviewer']);
    await expect(access(agentPath1)).rejects.toThrow();
    await expect(access(agentPath2)).resolves.toBeUndefined();

    const raw = await readFile(join(targetRoot, '.dotclaude-manifest.yaml'), 'utf8');
    expect(raw).toContain('other-preset');
    expect(raw).toContain('other-agent');
    expect(raw).not.toContain('my-preset');
  });

  it('reverts settings keys belonging only to the uninstalled preset', async () => {
    const settingsPath = join(targetRoot, 'settings.json');
    await writeFile(settingsPath, JSON.stringify({ myKey: 'value', otherKey: 'other' }));

    const manifest = makeManifest({
      presets: [{ name: 'my-preset', version: '1.0.0', kind: 'core' }],
      settings_patches: [{ preset: 'my-preset', patch_keys: ['myKey'] }],
    });
    await writeManifest(join(targetRoot, '.dotclaude-manifest.yaml'), manifest);

    const result = await uninstallPreset('my-preset', targetRoot);

    expect(result.settingsReverted).toEqual(['myKey']);
    expect(result.settingsKept).toEqual([]);
    const settings = JSON.parse(await readFile(settingsPath, 'utf8')) as Record<string, unknown>;
    expect(settings).not.toHaveProperty('myKey');
    expect(settings).toHaveProperty('otherKey', 'other');
  });

  it('keeps settings keys shared by other installed presets', async () => {
    const settingsPath = join(targetRoot, 'settings.json');
    await writeFile(settingsPath, JSON.stringify({ sharedKey: 'value' }));

    const manifest = makeManifest({
      presets: [
        { name: 'my-preset', version: '1.0.0', kind: 'core' },
        { name: 'other-preset', version: '1.0.0', kind: 'core' },
      ],
      settings_patches: [
        { preset: 'my-preset', patch_keys: ['sharedKey'] },
        { preset: 'other-preset', patch_keys: ['sharedKey'] },
      ],
    });
    await writeManifest(join(targetRoot, '.dotclaude-manifest.yaml'), manifest);

    const result = await uninstallPreset('my-preset', targetRoot);

    expect(result.settingsKept).toEqual(['sharedKey']);
    expect(result.settingsReverted).toEqual([]);
    const settings = JSON.parse(await readFile(settingsPath, 'utf8')) as Record<string, unknown>;
    expect(settings).toHaveProperty('sharedKey', 'value');
  });

  it('succeeds when component file was already manually removed', async () => {
    // Target file does not exist — uninstall should still succeed.
    const agentPath = join(targetRoot, 'agents', 'ghost-agent.md');

    const manifest = makeManifest({
      presets: [{ name: 'my-preset', version: '1.0.0', kind: 'core' }],
      components: [makeComponent({ id: 'ghost-agent', target_path: agentPath })],
    });
    await writeManifest(join(targetRoot, '.dotclaude-manifest.yaml'), manifest);

    const result = await uninstallPreset('my-preset', targetRoot);
    expect(result.removed).toEqual(['agent:ghost-agent']);
  });
});

// ── upgradePreset ─────────────────────────────────────────────────────────────

describe('upgradePreset', () => {
  let targetRoot: string;

  beforeEach(async () => {
    targetRoot = await mkdtemp(join(tmpdir(), 'dotclaude-upgrade-'));
  });

  afterEach(async () => {
    await rmFs(targetRoot, { recursive: true, force: true });
  });

  it('throws when no manifest exists', async () => {
    await expect(upgradePreset('my-preset', targetRoot)).rejects.toThrow('No manifest');
  });

  it('throws when preset is not installed', async () => {
    const manifest = makeManifest({ presets: [] });
    await writeManifest(join(targetRoot, '.dotclaude-manifest.yaml'), manifest);
    await expect(upgradePreset('my-preset', targetRoot)).rejects.toThrow('not installed');
  });

  it('dry-run with real fixtures returns a non-empty diff', async () => {
    const { buildInstallPlan } = await import('../lib/resolver.ts');
    const {
      buildManifestAdditions,
      mergeManifest: mergeFn,
    } = await import('../lib/manifest.ts');
    const { COMPONENT_TYPES: types } = await import('../lib/schema.ts');
    const {
      ensureDir: ensureDirFn,
      applyComponent: applyFn,
      componentTargetPath: cpFn,
    } = await import('../lib/fs-ops.ts');

    for (const type of types) {
      await ensureDirFn(join(targetRoot, type));
    }

    const plan = await buildInstallPlan('personal-baseline');
    for (const c of plan.components) {
      const dst = cpFn(c, targetRoot);
      await applyFn(
        c.layout.componentPath,
        dst,
        'copy',
        'backup-overwrite',
        c.layout.kind,
        targetRoot,
      );
    }
    const additions = buildManifestAdditions(plan, 'copy', targetRoot);
    const m = mergeFn(null, additions);
    await writeManifest(join(targetRoot, '.dotclaude-manifest.yaml'), m);

    const result = await upgradePreset('personal-baseline', targetRoot, {
      dryRun: true,
      mode: 'copy',
    });

    const total =
      result.added.length +
      result.removed.length +
      result.updated.length +
      result.unchanged.length;
    expect(total).toBeGreaterThan(0);
    // Dry-run: manifest should be unchanged.
    const raw = await readFile(join(targetRoot, '.dotclaude-manifest.yaml'), 'utf8');
    expect(raw).toContain('personal-baseline');
  });
});

// ── auditTarget ───────────────────────────────────────────────────────────────

describe('auditTarget', () => {
  let targetRoot: string;

  beforeEach(async () => {
    targetRoot = await mkdtemp(join(tmpdir(), 'dotclaude-audit-'));
  });

  afterEach(async () => {
    await rmFs(targetRoot, { recursive: true, force: true });
  });

  it('returns empty when target dir does not exist', async () => {
    const result = await auditTarget(join(targetRoot, 'nonexistent'));
    expect(result).toEqual([]);
  });

  it('classifies all files as untracked when no manifest', async () => {
    await mkdir(join(targetRoot, 'agents'), { recursive: true });
    await writeFile(join(targetRoot, 'agents', 'my-agent.md'), '# agent');

    const result = await auditTarget(targetRoot);

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('untracked');
    expect(result[0]).not.toHaveProperty('component');
  });

  it('classifies tracked files correctly', async () => {
    const agentsDir = join(targetRoot, 'agents');
    await mkdir(agentsDir, { recursive: true });
    const agentPath = join(agentsDir, 'code-reviewer.md');
    await writeFile(agentPath, '# agent');

    const manifest = makeManifest({
      presets: [{ name: 'p', version: '1.0.0', kind: 'core' }],
      components: [makeComponent({ target_path: agentPath, preset: 'p' })],
    });
    await writeManifest(join(targetRoot, '.dotclaude-manifest.yaml'), manifest);

    const result = await auditTarget(targetRoot);

    const tracked = result.filter((e) => e.status === 'tracked');
    const untracked = result.filter((e) => e.status === 'untracked');
    expect(tracked).toHaveLength(1);
    expect(tracked[0]?.component).toBe('agent:code-reviewer');
    expect(tracked[0]?.preset).toBe('p');
    expect(untracked).toHaveLength(0);
  });

  it('reports missing for manifest entries absent from disk', async () => {
    const agentsDir = join(targetRoot, 'agents');
    await mkdir(agentsDir, { recursive: true });
    const agentPath = join(agentsDir, 'ghost.md');
    // File NOT created.

    const manifest = makeManifest({
      presets: [{ name: 'p', version: '1.0.0', kind: 'core' }],
      components: [makeComponent({ id: 'ghost', target_path: agentPath, preset: 'p' })],
    });
    await writeManifest(join(targetRoot, '.dotclaude-manifest.yaml'), manifest);

    const result = await auditTarget(targetRoot);

    const missing = result.filter((e) => e.status === 'missing');
    expect(missing).toHaveLength(1);
    expect(missing[0]?.path).toBe(agentPath);
    expect(missing[0]?.component).toBe('agent:ghost');
  });

  it('skips backup files', async () => {
    await mkdir(join(targetRoot, 'agents'), { recursive: true });
    await writeFile(
      join(targetRoot, 'agents', 'code-reviewer.md.bak.2026-05-08T10-00-00-000Z'),
      'backup',
    );

    const result = await auditTarget(targetRoot);

    expect(result.filter((e) => e.status === 'untracked')).toHaveLength(0);
  });

  it('reports mix of tracked and untracked', async () => {
    const agentsDir = join(targetRoot, 'agents');
    await mkdir(agentsDir, { recursive: true });
    const trackedPath = join(agentsDir, 'tracked-agent.md');
    const untrackedPath = join(agentsDir, 'manual-agent.md');
    await writeFile(trackedPath, '# tracked');
    await writeFile(untrackedPath, '# manual');

    const manifest = makeManifest({
      presets: [{ name: 'p', version: '1.0.0', kind: 'core' }],
      components: [makeComponent({ id: 'tracked-agent', target_path: trackedPath, preset: 'p' })],
    });
    await writeManifest(join(targetRoot, '.dotclaude-manifest.yaml'), manifest);

    const result = await auditTarget(targetRoot);

    expect(result.filter((e) => e.status === 'tracked')).toHaveLength(1);
    expect(result.filter((e) => e.status === 'untracked')).toHaveLength(1);
    expect(result.find((e) => e.status === 'untracked')?.path).toBe(untrackedPath);
  });
});
