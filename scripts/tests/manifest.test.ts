import { describe, it, expect } from 'vitest';
import { mergeManifest } from '../lib/manifest.ts';
import type { Manifest } from '../lib/schema.ts';

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

// ── mergeManifest ─────────────────────────────────────────────────────────────

describe('mergeManifest', () => {
  it('creates fresh manifest when old is null', () => {
    const result = mergeManifest(null, {
      presets: [{ name: 'p', version: '0.1.0', kind: 'core' }],
      components: [],
      settings_patches: [],
      external_deps: [],
    });
    expect(result.schema_version).toBe(1);
    expect(result.presets).toHaveLength(1);
    expect(result.presets[0]?.name).toBe('p');
  });

  it('new entry wins when preset name collides', () => {
    const old = makeManifest({
      presets: [{ name: 'p', version: '0.1.0', kind: 'core' }],
    });
    const result = mergeManifest(old, {
      presets: [{ name: 'p', version: '0.2.0', kind: 'core' }],
      components: [],
      settings_patches: [],
      external_deps: [],
    });
    expect(result.presets).toHaveLength(1);
    expect(result.presets[0]?.version).toBe('0.2.0');
  });

  it('preserves old presets that are not in new additions', () => {
    const old = makeManifest({
      presets: [
        { name: 'old-preset', version: '1.0.0', kind: 'core' },
      ],
    });
    const result = mergeManifest(old, {
      presets: [{ name: 'new-preset', version: '0.1.0', kind: 'framework' }],
      components: [],
      settings_patches: [],
      external_deps: [],
    });
    expect(result.presets).toHaveLength(2);
  });

  it('new component wins when type:id collides', () => {
    const old = makeManifest({
      components: [
        {
          type: 'agent',
          id: 'code-reviewer',
          target_path: '/old/path',
          mode: 'symlink',
          source_path: '/old/src',
          source_commit: null,
          preset: 'p',
          auto_included: false,
          required_by: [],
        },
      ],
    });
    const result = mergeManifest(old, {
      presets: [],
      components: [
        {
          type: 'agent',
          id: 'code-reviewer',
          target_path: '/new/path',
          mode: 'copy',
          source_path: '/new/src',
          source_commit: null,
          preset: 'p2',
          auto_included: false,
          required_by: [],
        },
      ],
      settings_patches: [],
      external_deps: [],
    });
    expect(result.components).toHaveLength(1);
    expect(result.components[0]?.target_path).toBe('/new/path');
    expect(result.components[0]?.mode).toBe('copy');
  });

  it('new settings_patch wins when preset name collides', () => {
    const old = makeManifest({
      settings_patches: [{ preset: 'p', patch_keys: ['oldKey'] }],
    });
    const result = mergeManifest(old, {
      presets: [],
      components: [],
      settings_patches: [{ preset: 'p', patch_keys: ['newKey'] }],
      external_deps: [],
    });
    expect(result.settings_patches).toHaveLength(1);
    expect(result.settings_patches[0]?.patch_keys).toEqual(['newKey']);
  });

  it('installed_at is updated on every merge', async () => {
    const before = Date.now();
    const result = mergeManifest(
      makeManifest({ installed_at: '2020-01-01T00:00:00.000Z' }),
      { presets: [], components: [], settings_patches: [], external_deps: [] },
    );
    const after = Date.now();
    const ts = new Date(result.installed_at).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
