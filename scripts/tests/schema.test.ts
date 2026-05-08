import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  PresetSchema,
  SidecarSchema,
  ManifestSchema,
} from '../lib/schema.ts';

describe('PresetSchema', () => {
  it('accepts a minimal valid preset', () => {
    const data = {
      name: 'personal-baseline',
      kind: 'core',
      description: 'baseline',
      version: '0.1.0',
    };
    const parsed = PresetSchema.parse(data);
    expect(parsed.extends).toEqual([]);
    expect(parsed.components.agents).toEqual([]);
    expect(parsed.tags).toEqual([]);
  });

  it('rejects invalid kind', () => {
    expect(() =>
      PresetSchema.parse({
        name: 'x',
        kind: 'unknown',
        description: 'x',
        version: '1.0.0',
      }),
    ).toThrow(z.ZodError);
  });

  it('rejects non-semver version', () => {
    expect(() =>
      PresetSchema.parse({
        name: 'x',
        kind: 'core',
        description: 'x',
        version: '1.0',
      }),
    ).toThrow(z.ZodError);
  });

  it('rejects non-kebab-case name', () => {
    expect(() =>
      PresetSchema.parse({
        name: 'PersonalBaseline',
        kind: 'core',
        description: 'x',
        version: '1.0.0',
      }),
    ).toThrow(z.ZodError);
  });

  it('rejects unknown top-level keys (strict)', () => {
    expect(() =>
      PresetSchema.parse({
        name: 'x',
        kind: 'core',
        description: 'x',
        version: '1.0.0',
        unknown_field: 'oops',
      }),
    ).toThrow(z.ZodError);
  });
});

describe('SidecarSchema', () => {
  const baseValid = {
    source: {
      repo: 'https://github.com/example/repo',
      commit: '0123456789abcdef0123456789abcdef01234567',
      path: 'agents/x.md',
      ref: 'main',
    },
    imported_at: '2026-05-08',
    license: 'MIT',
    modified: false,
  };

  it('accepts minimal valid sidecar with defaults', () => {
    const parsed = SidecarSchema.parse(baseValid);
    expect(parsed.dependencies.required.skills).toEqual([]);
    expect(parsed.dependencies.optional.agents).toEqual([]);
    expect(parsed.dependencies.external).toEqual([]);
    expect(parsed.modifications).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it('rejects short commit SHA', () => {
    expect(() =>
      SidecarSchema.parse({ ...baseValid, source: { ...baseValid.source, commit: 'abc123' } }),
    ).toThrow(z.ZodError);
  });

  it('rejects malformed imported_at', () => {
    expect(() =>
      SidecarSchema.parse({ ...baseValid, imported_at: '2026/05/08' }),
    ).toThrow(z.ZodError);
  });

  it('accepts external dep with version + reason', () => {
    const parsed = SidecarSchema.parse({
      ...baseValid,
      dependencies: {
        external: [
          { name: 'prettier', type: 'npm', version: '>=3.0', reason: 'format' },
        ],
      },
    });
    expect(parsed.dependencies.external[0]?.name).toBe('prettier');
    expect(parsed.dependencies.required.skills).toEqual([]);
  });

  it('rejects external dep with unknown type', () => {
    expect(() =>
      SidecarSchema.parse({
        ...baseValid,
        dependencies: {
          external: [{ name: 'x', type: 'cargo', version: '1.0' }],
        },
      }),
    ).toThrow(z.ZodError);
  });
});

describe('ManifestSchema', () => {
  it('accepts a minimal manifest', () => {
    const data = {
      schema_version: 1,
      installed_at: '2026-05-08T10:00:00Z',
      presets: [{ name: 'p', version: '0.1.0', kind: 'core' }],
      components: [
        {
          type: 'agent',
          id: 'code-reviewer',
          target_path: '/home/u/.claude/agents/code-reviewer.md',
          mode: 'symlink',
          source_path: '/repo/claudekit/agents/code-reviewer.md',
          source_commit: 'abcdef0123456789abcdef0123456789abcdef01',
          preset: 'p',
          auto_included: false,
        },
      ],
    };
    const parsed = ManifestSchema.parse(data);
    expect(parsed.components[0]?.id).toBe('code-reviewer');
    expect(parsed.components[0]?.required_by).toEqual([]);
    expect(parsed.settings_patches).toEqual([]);
  });

  it('rejects schema_version != 1', () => {
    expect(() =>
      ManifestSchema.parse({
        schema_version: 2,
        installed_at: '2026-05-08T10:00:00Z',
        presets: [],
        components: [],
      }),
    ).toThrow(z.ZodError);
  });
});
