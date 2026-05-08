import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { loadYaml } from './yaml.ts';
import {
  PresetSchema,
  PRESET_KINDS,
  type Preset,
  type PresetKind,
} from './schema.ts';
import { PRESETS_DIR, PRESETS_PRIVATE_DIR } from './paths.ts';

export interface PresetLocation {
  preset: Preset;
  scope: 'public' | 'private';
  yamlPath: string;
  mdPath: string | null;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function locatePreset(
  name: string,
  opts: { kind?: PresetKind } = {},
): Promise<PresetLocation> {
  const kindsToScan: readonly PresetKind[] = opts.kind ? [opts.kind] : PRESET_KINDS;
  const errors: string[] = [];

  for (const scope of ['public', 'private'] as const) {
    const base = scope === 'public' ? PRESETS_DIR : PRESETS_PRIVATE_DIR;
    for (const kind of kindsToScan) {
      const yamlPath = join(base, kind, `${name}.yaml`);
      if (!(await pathExists(yamlPath))) continue;

      let preset: Preset;
      try {
        preset = await loadPresetFile(yamlPath);
      } catch (err) {
        errors.push(`${yamlPath}: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }

      if (preset.name !== name) {
        errors.push(
          `${yamlPath}: preset.name "${preset.name}" does not match filename "${name}"`,
        );
        continue;
      }
      if (preset.kind !== kind) {
        errors.push(
          `${yamlPath}: preset.kind "${preset.kind}" does not match folder "${kind}"`,
        );
        continue;
      }

      const mdPath = join(base, kind, `${name}.md`);
      const mdExists = await pathExists(mdPath);
      return { preset, scope, yamlPath, mdPath: mdExists ? mdPath : null };
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Preset "${name}" found but invalid:\n${errors.map((e) => '  ' + e).join('\n')}`,
    );
  }
  throw new Error(
    `Preset "${name}" not found in ${kindsToScan.map((k) => `presets/${k}/`).join(', ')} (public or private).`,
  );
}

export async function loadPresetFile(yamlPath: string): Promise<Preset> {
  const raw = await readFile(yamlPath, 'utf8');
  const data = loadYaml(raw);
  try {
    return PresetSchema.parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues
        .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid preset:\n${issues}`);
    }
    throw err;
  }
}

export interface PresetIndexEntry {
  name: string;
  kind: PresetKind;
  scope: 'public' | 'private';
  yamlPath: string;
  preset: Preset;
}

export async function listAllPresets(
  opts: { kind?: PresetKind; scope?: 'public' | 'private' | 'all' } = {},
): Promise<PresetIndexEntry[]> {
  const scopes: readonly ('public' | 'private')[] =
    !opts.scope || opts.scope === 'all' ? ['public', 'private'] : [opts.scope];
  const kindsToScan: readonly PresetKind[] = opts.kind ? [opts.kind] : PRESET_KINDS;

  const out: PresetIndexEntry[] = [];
  for (const scope of scopes) {
    const base = scope === 'public' ? PRESETS_DIR : PRESETS_PRIVATE_DIR;
    for (const kind of kindsToScan) {
      const dir = join(base, kind);
      if (!(await pathExists(dir))) continue;
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        continue;
      }
      for (const file of entries) {
        if (!file.endsWith('.yaml')) continue;
        const yamlPath = join(dir, file);
        const name = file.replace(/\.yaml$/, '');
        try {
          const preset = await loadPresetFile(yamlPath);
          if (preset.name !== name || preset.kind !== kind) continue;
          out.push({ name, kind, scope, yamlPath, preset });
        } catch {
          // skip malformed presets in list view
        }
      }
    }
  }
  return out;
}
