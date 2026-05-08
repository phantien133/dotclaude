import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Preset, ComponentType, PresetKind, Sidecar, ExternalDep, ExternalDepProbe } from './schema.ts';
import type { ComponentLayout } from './sidecar.ts';
import { locatePreset } from './preset.ts';
import { locateComponent, loadSidecar } from './sidecar.ts';

const execFileAsync = promisify(execFile);

export interface PlannedComponent {
  type: ComponentType;
  id: string;
  scope: 'public' | 'private';
  layout: ComponentLayout;
  sidecar: Sidecar | null;
  source_commit: string | null;
  auto_included: boolean;
  required_by: string[];
}

export interface InstallPlan {
  preset: Preset;
  all_presets: Preset[];
  components: PlannedComponent[];
  merged_settings_patch: Record<string, unknown>;
  external_warnings: ExternalDepProbe[];
  dep_log: string[];
}

export interface ResolveOptions {
  include_optional?: boolean;
  kind?: PresetKind;
}

// Returns all presets in the extends tree in dependency order (parents first).
// Detects circular references and deduplicates diamonds.
export async function resolveExtends(root: Preset): Promise<Preset[]> {
  const result: Preset[] = [];
  const visited = new Set<string>();
  const inPath = new Set<string>();

  async function visit(p: Preset): Promise<void> {
    if (inPath.has(p.name)) {
      throw new Error(`Circular preset extends: ${[...inPath].join(' → ')} → ${p.name}`);
    }
    if (visited.has(p.name)) return;
    inPath.add(p.name);
    for (const extName of p.extends) {
      const { preset: extPreset } = await locatePreset(extName);
      await visit(extPreset);
    }
    inPath.delete(p.name);
    visited.add(p.name);
    result.push(p);
  }

  await visit(root);
  return result;
}

// Merges settings_patch from all presets in order (parents first, child wins conflicts).
// Arrays are concatenated; plain objects are deep-merged; scalars: later wins.
export function mergeSettingsPatches(presets: Preset[]): Record<string, unknown> {
  let merged: Record<string, unknown> = {};
  for (const p of presets) {
    merged = deepMerge(merged, p.settings_patch);
  }
  return merged;
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const existing = result[k];
    if (isPlainObject(existing) && isPlainObject(v)) {
      result[k] = deepMerge(existing, v);
    } else if (Array.isArray(existing) && Array.isArray(v)) {
      result[k] = [...existing, ...v];
    } else {
      result[k] = v;
    }
  }
  return result;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function addComponentToMap(
  type: ComponentType,
  id: string,
  plan: Map<string, PlannedComponent>,
  opts: ResolveOptions,
  depProcessed: Set<string>,
  depLog: string[],
  autoIncluded: boolean,
  requiredBy: string[],
  throwIfMissing: boolean,
): Promise<void> {
  const key = `${type}:${id}`;
  const existing = plan.get(key);
  if (existing !== undefined) {
    for (const r of requiredBy) {
      if (!existing.required_by.includes(r)) existing.required_by.push(r);
    }
    return;
  }

  const loc = await locateComponent({ type, id });
  if (loc === null) {
    if (!throwIfMissing) {
      depLog.push(`[skip] "${key}" not found`);
      return;
    }
    throw new Error(`Component "${key}" not found in claudekit/ (public or private)`);
  }

  const component: PlannedComponent = {
    type,
    id,
    scope: loc.scope,
    layout: loc.layout,
    sidecar: null,
    source_commit: null,
    auto_included: autoIncluded,
    required_by: [...requiredBy],
  };

  try {
    component.sidecar = await loadSidecar(loc.layout.sidecarPath);
    component.source_commit = component.sidecar.source.commit;
  } catch {
    depLog.push(`[warn] no sidecar for "${key}"`);
  }

  plan.set(key, component);
  await expandDeps(component, plan, opts, depProcessed, depLog);
}

async function expandDeps(
  component: PlannedComponent,
  plan: Map<string, PlannedComponent>,
  opts: ResolveOptions,
  depProcessed: Set<string>,
  depLog: string[],
): Promise<void> {
  const key = `${component.type}:${component.id}`;
  if (depProcessed.has(key)) return;
  depProcessed.add(key);

  if (component.sidecar === null) return;

  const { required, optional } = component.sidecar.dependencies;
  const depGroups: Array<{ group: typeof required; throwIfMissing: boolean }> = [
    { group: required, throwIfMissing: true },
    ...(opts.include_optional === true
      ? [{ group: optional, throwIfMissing: false }]
      : []),
  ];

  for (const { group, throwIfMissing } of depGroups) {
    for (const [depType, depIds] of Object.entries(group) as [ComponentType, string[]][]) {
      for (const depId of depIds) {
        const depKey = `${depType}:${depId}`;
        if (!plan.has(depKey)) {
          const verb = throwIfMissing ? 'required' : 'optional';
          depLog.push(`[dep] auto-include "${depKey}" (${verb} by "${key}")`);
        }
        await addComponentToMap(
          depType,
          depId,
          plan,
          opts,
          depProcessed,
          depLog,
          true,
          [key],
          throwIfMissing,
        );
      }
    }
  }
}

async function probeOneDep(dep: ExternalDep): Promise<ExternalDepProbe> {
  let found = false;
  let detected_version: string | null = null;

  try {
    if (dep.type === 'system_binary') {
      const { stdout } = await execFileAsync('which', [dep.name], { timeout: 3000 });
      found = stdout.trim().length > 0;
      if (found) {
        try {
          const { stdout: vOut } = await execFileAsync(dep.name, ['--version'], {
            timeout: 2000,
          });
          const firstLine = vOut.trim().split('\n')[0];
          detected_version = firstLine !== undefined ? firstLine : null;
        } catch {
          // --version not supported by this binary
        }
      }
    } else if (dep.type === 'npm') {
      try {
        await execFileAsync('node', ['-e', `require.resolve(${JSON.stringify(dep.name)})`], {
          timeout: 3000,
        });
        found = true;
      } catch {
        try {
          const { stdout } = await execFileAsync(
            'npm',
            ['ls', '--global', '--depth=0', dep.name],
            { timeout: 5000 },
          );
          found = stdout.includes(dep.name);
        } catch {
          found = false;
        }
      }
    } else if (dep.type === 'python_pkg') {
      const importName = dep.name.replace(/-/g, '_');
      try {
        const { stdout } = await execFileAsync(
          'python3',
          [
            '-c',
            `import ${importName}; print(getattr(${importName}, '__version__', 'unknown'))`,
          ],
          { timeout: 3000 },
        );
        found = true;
        detected_version = stdout.trim() || null;
      } catch {
        found = false;
      }
    }
  } catch {
    found = false;
  }

  const probe: ExternalDepProbe = {
    name: dep.name,
    type: dep.type,
    found,
    detected_version,
    requested_by: [],
  };
  if (dep.version !== undefined) probe.version = dep.version;
  if (dep.reason !== undefined) probe.reason = dep.reason;
  return probe;
}

async function probeAllExternalDeps(
  plan: Map<string, PlannedComponent>,
  depLog: string[],
): Promise<ExternalDepProbe[]> {
  const extMap = new Map<string, { dep: ExternalDep; requestedBy: string[] }>();

  for (const [key, component] of plan) {
    if (component.sidecar === null) continue;
    for (const extDep of component.sidecar.dependencies.external) {
      const entry = extMap.get(extDep.name);
      if (entry !== undefined) {
        entry.requestedBy.push(key);
      } else {
        extMap.set(extDep.name, { dep: extDep, requestedBy: [key] });
      }
    }
  }

  const probes: ExternalDepProbe[] = [];
  for (const { dep, requestedBy } of extMap.values()) {
    const probe = await probeOneDep(dep);
    probe.requested_by = requestedBy;
    probes.push(probe);
    if (!probe.found) {
      const reasonStr = dep.reason !== undefined ? ` — ${dep.reason}` : '';
      depLog.push(`[warn] external dep "${dep.name}" (${dep.type}) not found${reasonStr}`);
    }
  }

  return probes;
}

export async function buildInstallPlan(
  presetName: string,
  opts: ResolveOptions = {},
): Promise<InstallPlan> {
  const locateOpts: Parameters<typeof locatePreset>[1] = {};
  if (opts.kind !== undefined) locateOpts.kind = opts.kind;
  const { preset } = await locatePreset(presetName, locateOpts);
  const allPresets = await resolveExtends(preset);

  const plan = new Map<string, PlannedComponent>();
  const depProcessed = new Set<string>();
  const depLog: string[] = [];

  for (const p of allPresets) {
    for (const [type, ids] of Object.entries(p.components) as [ComponentType, string[]][]) {
      for (const id of ids) {
        await addComponentToMap(type, id, plan, opts, depProcessed, depLog, false, [], true);
      }
    }
  }

  const externalWarnings = await probeAllExternalDeps(plan, depLog);
  const mergedSettingsPatch = mergeSettingsPatches(allPresets);

  return {
    preset,
    all_presets: allPresets,
    components: [...plan.values()],
    merged_settings_patch: mergedSettingsPatch,
    external_warnings: externalWarnings,
    dep_log: depLog,
  };
}
