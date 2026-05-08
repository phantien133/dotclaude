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

// Each preset lives in its own folder: presets/<kind>/<name>/
//   preset.yaml  — machine-readable manifest (schema-validated)
//   README.md    — human docs (optional)
//   scripts/     — optional helper scripts
//   hooks/       — optional hook configs
export interface PresetLocation {
  preset: Preset;
  scope: 'public' | 'private';
  presetDir: string;   // path to the preset folder
  yamlPath: string;    // <presetDir>/preset.yaml
  mdPath: string | null; // <presetDir>/README.md, or null if absent
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
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
      const presetDir = join(base, kind, name);
      if (!(await isDirectory(presetDir))) continue;

      const yamlPath = join(presetDir, 'preset.yaml');
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
          `${yamlPath}: preset.name "${preset.name}" does not match folder name "${name}"`,
        );
        continue;
      }
      if (preset.kind !== kind) {
        errors.push(
          `${yamlPath}: preset.kind "${preset.kind}" does not match parent folder "${kind}"`,
        );
        continue;
      }

      const mdPath = join(presetDir, 'README.md');
      const mdExists = await pathExists(mdPath);
      return { preset, scope, presetDir, yamlPath, mdPath: mdExists ? mdPath : null };
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Preset "${name}" found but invalid:\n${errors.map((e) => '  ' + e).join('\n')}`,
    );
  }
  throw new Error(
    `Preset "${name}" not found in ${kindsToScan.map((k) => `presets/${k}/${name}/`).join(', ')} (public or private).`,
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
  presetDir: string;
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
      const kindDir = join(base, kind);
      if (!(await pathExists(kindDir))) continue;
      let entries: string[];
      try {
        entries = await readdir(kindDir);
      } catch {
        continue;
      }
      for (const entry of entries) {
        const presetDir = join(kindDir, entry);
        if (!(await isDirectory(presetDir))) continue; // skip .gitkeep and flat files
        const yamlPath = join(presetDir, 'preset.yaml');
        if (!(await pathExists(yamlPath))) continue;
        try {
          const preset = await loadPresetFile(yamlPath);
          if (preset.name !== entry || preset.kind !== kind) continue;
          out.push({ name: entry, kind, scope, presetDir, yamlPath, preset });
        } catch {
          // skip malformed presets in list view
        }
      }
    }
  }
  return out;
}
