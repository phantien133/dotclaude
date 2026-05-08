import { readFile, rename, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  ManifestSchema,
  type ComponentType,
  type ExternalDepProbe,
  type InstalledComponent,
  type InstalledPreset,
  type Manifest,
  type SettingsPatchEntry,
} from './schema.ts';
import { loadYaml, dumpYaml } from './yaml.ts';
import type { InstallPlan } from './resolver.ts';
import type { InstallMode } from './fs-ops.ts';
import { componentTargetPath } from './fs-ops.ts';

const COMPONENT_SINGULAR: Record<ComponentType, InstalledComponent['type']> = {
  agents: 'agent',
  skills: 'skill',
  commands: 'command',
  hooks: 'hook',
  rules: 'rule',
};

// Returns null if the manifest file does not exist.
export async function loadManifest(path: string): Promise<Manifest | null> {
  try {
    const raw = await readFile(path, 'utf8');
    const data = loadYaml(raw);
    return ManifestSchema.parse(data);
  } catch (err) {
    if (err instanceof Error && 'code' in err) {
      const errno = (err as NodeJS.ErrnoException).code;
      if (errno === 'ENOENT') return null;
    }
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`Invalid manifest at ${path}:\n${issues}`);
    }
    throw err;
  }
}

// Writes manifest atomically via tmp file + rename.
export async function writeManifest(path: string, manifest: Manifest): Promise<void> {
  const tmp = `${path}.tmp.${Date.now()}`;
  await writeFile(tmp, dumpYaml(manifest), 'utf8');
  await rename(tmp, path);
}

// Derives the manifest additions (presets, components, patches, ext deps) from a plan.
export function buildManifestAdditions(
  plan: InstallPlan,
  mode: InstallMode,
  targetRoot: string,
): {
  presets: InstalledPreset[];
  components: InstalledComponent[];
  settings_patches: SettingsPatchEntry[];
  external_deps: ExternalDepProbe[];
} {
  const presets: InstalledPreset[] = plan.all_presets.map((p) => ({
    name: p.name,
    version: p.version,
    kind: p.kind,
  }));

  const components: InstalledComponent[] = plan.components.map((c) => {
    // Folder components are always symlinked (Q2-5 decision).
    const effectiveMode: InstallMode = c.layout.kind === 'folder' ? 'symlink' : mode;
    return {
      type: COMPONENT_SINGULAR[c.type],
      id: c.id,
      target_path: componentTargetPath(c, targetRoot),
      mode: effectiveMode,
      source_path: c.layout.componentPath,
      source_commit: c.source_commit,
      preset: plan.preset.name,
      auto_included: c.auto_included,
      required_by: c.required_by,
    };
  });

  const settings_patches: SettingsPatchEntry[] = plan.all_presets
    .filter((p) => Object.keys(p.settings_patch).length > 0)
    .map((p) => ({
      preset: p.name,
      patch_keys: Object.keys(p.settings_patch),
    }));

  return {
    presets,
    components,
    settings_patches,
    external_deps: plan.external_warnings,
  };
}

// Merges manifest additions into an existing manifest (or creates a fresh one).
// Deduplication: later entry wins by name/type:id/preset.
export function mergeManifest(
  old: Manifest | null,
  additions: {
    presets: InstalledPreset[];
    components: InstalledComponent[];
    settings_patches: SettingsPatchEntry[];
    external_deps: ExternalDepProbe[];
  },
): Manifest {
  const now = new Date().toISOString();

  if (old === null) {
    return {
      schema_version: 1,
      installed_at: now,
      presets: additions.presets,
      components: additions.components,
      settings_patches: additions.settings_patches,
      external_deps: additions.external_deps,
    };
  }

  const presetMap = new Map(old.presets.map((p) => [p.name, p]));
  for (const p of additions.presets) presetMap.set(p.name, p);

  const componentMap = new Map(old.components.map((c) => [`${c.type}:${c.id}`, c]));
  for (const c of additions.components) componentMap.set(`${c.type}:${c.id}`, c);

  const patchMap = new Map(old.settings_patches.map((p) => [p.preset, p]));
  for (const p of additions.settings_patches) patchMap.set(p.preset, p);

  const extMap = new Map(old.external_deps.map((d) => [d.name, d]));
  for (const d of additions.external_deps) extMap.set(d.name, d);

  return {
    schema_version: 1,
    installed_at: now,
    presets: [...presetMap.values()],
    components: [...componentMap.values()],
    settings_patches: [...patchMap.values()],
    external_deps: [...extMap.values()],
  };
}
