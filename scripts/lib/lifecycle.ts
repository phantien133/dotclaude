import { lstat, readdir, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import type { Manifest, PresetKind } from './schema.ts';
import { COMPONENT_TYPES } from './schema.ts';
import {
  loadManifest,
  writeManifest,
  buildManifestAdditions,
  mergeManifest,
} from './manifest.ts';
import {
  loadSettings,
  writeSettings,
  mergeSettings,
  subtractSettings,
  rewriteHookPaths,
} from './settings-merge.ts';
import { buildInstallPlan } from './resolver.ts';
import {
  applyComponent,
  componentTargetPath,
  ensureDir,
  type InstallMode,
  type ConflictPolicy,
} from './fs-ops.ts';

// ── Guard ─────────────────────────────────────────────────────────────────────

function guardWithinRoot(path: string, root: string): void {
  const rp = resolve(path);
  const rr = resolve(root);
  if (!rp.startsWith(rr + sep) && rp !== rr) {
    throw new Error(`Path traversal blocked: "${path}" is outside root "${root}"`);
  }
}

// ── Uninstall ─────────────────────────────────────────────────────────────────

export interface UninstallResult {
  removed: string[];
  settingsReverted: string[];
  settingsKept: string[];
}

export async function uninstallPreset(
  presetName: string,
  targetRoot: string,
  opts: { dryRun?: boolean } = {},
): Promise<UninstallResult> {
  const manifestPath = join(targetRoot, '.dotclaude-manifest.yaml');
  const manifest = await loadManifest(manifestPath);
  if (manifest === null) {
    throw new Error(`No manifest at ${manifestPath}. Run install first.`);
  }

  if (!manifest.presets.some((p) => p.name === presetName)) {
    throw new Error(`Preset "${presetName}" is not installed at ${targetRoot}.`);
  }

  const toRemove = manifest.components.filter((c) => c.preset === presetName);
  const toRetain = manifest.components.filter((c) => c.preset !== presetName);

  const removed: string[] = [];

  for (const c of toRemove) {
    guardWithinRoot(c.target_path, targetRoot);
    if (!opts.dryRun) {
      await rm(c.target_path, { recursive: true, force: true });
    }
    removed.push(`${c.type}:${c.id}`);
  }

  // Settings patch revert. Prefer surgical subtraction (when the recorded
  // patch value is available) so we only undo this preset's contribution;
  // fall back to top-level-key removal for legacy manifest entries.
  const settingsReverted: string[] = [];
  const settingsKept: string[] = [];

  const removingPatch = manifest.settings_patches.find((p) => p.preset === presetName);
  if (removingPatch !== undefined && removingPatch.patch_keys.length > 0) {
    const otherPatchedKeys = new Set(
      manifest.settings_patches
        .filter((p) => p.preset !== presetName)
        .flatMap((p) => p.patch_keys),
    );

    for (const key of removingPatch.patch_keys) {
      if (otherPatchedKeys.has(key)) {
        settingsKept.push(key);
      } else {
        settingsReverted.push(key);
      }
    }

    if (!opts.dryRun && (removingPatch.patch !== undefined || settingsReverted.length > 0)) {
      const settingsPath = join(targetRoot, 'settings.json');
      const existing = await loadSettings(settingsPath);
      let next: Record<string, unknown>;
      if (removingPatch.patch !== undefined) {
        next = subtractSettings(existing, removingPatch.patch);
      } else {
        next = Object.fromEntries(
          Object.entries(existing).filter(([k]) => !settingsReverted.includes(k)),
        );
      }
      await writeSettings(settingsPath, next);
    }
  }

  if (!opts.dryRun) {
    const updated: Manifest = {
      schema_version: 1,
      installed_at: new Date().toISOString(),
      presets: manifest.presets.filter((p) => p.name !== presetName),
      components: toRetain,
      settings_patches: manifest.settings_patches.filter((p) => p.preset !== presetName),
      external_deps: manifest.external_deps,
    };
    await writeManifest(manifestPath, updated);
  }

  return { removed, settingsReverted, settingsKept };
}

// ── Upgrade ───────────────────────────────────────────────────────────────────

export interface UpgradeResult {
  added: string[];
  removed: string[];
  updated: string[];
  unchanged: string[];
}

export interface UpgradeOptions {
  dryRun?: boolean;
  mode?: InstallMode;
  conflictPolicy?: ConflictPolicy;
  includeOptional?: boolean;
  kind?: PresetKind;
  // Install scope. Determines how `~/.claude/hooks/` in settings_patches is
  // rewritten: `project` → ${CLAUDE_PROJECT_DIR}/.claude/hooks/, `user` →
  // absolute path under targetRoot/hooks. Defaults to 'user' for back-compat
  // (matches the prior behavior when scope was unspecified).
  scope?: 'user' | 'project';
}

export async function upgradePreset(
  presetName: string,
  targetRoot: string,
  opts: UpgradeOptions = {},
): Promise<UpgradeResult> {
  const mode: InstallMode = opts.mode ?? 'symlink';
  const conflictPolicy: ConflictPolicy = opts.conflictPolicy ?? 'backup-overwrite';

  const manifestPath = join(targetRoot, '.dotclaude-manifest.yaml');
  const manifest = await loadManifest(manifestPath);
  if (manifest === null) {
    throw new Error(`No manifest at ${manifestPath}. Run install first.`);
  }

  if (!manifest.presets.some((p) => p.name === presetName)) {
    throw new Error(`Preset "${presetName}" is not installed at ${targetRoot}. Run install first.`);
  }

  const resolveOpts: Parameters<typeof buildInstallPlan>[1] = {};
  if (opts.includeOptional === true) resolveOpts.include_optional = true;
  if (opts.kind !== undefined) resolveOpts.kind = opts.kind;
  const plan = await buildInstallPlan(presetName, resolveOpts);

  const existingComponents = manifest.components.filter((c) => c.preset === presetName);

  type ExistingEntry = (typeof existingComponents)[number];
  const existingKeys = new Map<string, ExistingEntry>(
    existingComponents.map((c) => [`${c.type}:${c.id}`, c]),
  );

  type PlannedEntry = (typeof plan.components)[number];
  const newKeys = new Map<string, PlannedEntry>(
    plan.components.map((c) => [`${c.type}:${c.id}`, c]),
  );

  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];

  for (const [key, incoming] of newKeys) {
    const existing = existingKeys.get(key);
    if (existing === undefined) {
      added.push(key);
    } else if (
      existing.source_commit !== null &&
      incoming.source_commit !== null &&
      existing.source_commit === incoming.source_commit
    ) {
      unchanged.push(key);
    } else {
      updated.push(key);
    }
  }

  for (const key of existingKeys.keys()) {
    if (!newKeys.has(key)) removed.push(key);
  }

  if (opts.dryRun === true) {
    return { added, removed, updated, unchanged };
  }

  // Remove components no longer in the new plan.
  for (const key of removed) {
    const comp = existingKeys.get(key);
    if (comp !== undefined) {
      guardWithinRoot(comp.target_path, targetRoot);
      await rm(comp.target_path, { recursive: true, force: true });
    }
  }

  // Ensure type subdirs exist.
  for (const type of COMPONENT_TYPES) {
    await ensureDir(join(targetRoot, type));
  }

  // Install added + updated components.
  for (const component of plan.components) {
    const key = `${component.type}:${component.id}`;
    if (!added.includes(key) && !updated.includes(key)) continue;
    const src = component.layout.componentPath;
    const dst = componentTargetPath(component, targetRoot);
    await applyComponent(src, dst, mode, conflictPolicy, component.layout.kind, targetRoot);
  }

  // Rewrite hook paths in this upgrade's incoming patches to match the
  // install-target convention before applying or recording them.
  const scope: 'user' | 'project' = opts.scope ?? 'user';
  const hooksDir = scope === 'project'
    ? '${CLAUDE_PROJECT_DIR}/.claude/hooks'
    : join(resolve(targetRoot), 'hooks');
  const rewrittenMergedPatch = rewriteHookPaths(plan.merged_settings_patch, hooksDir);
  const rewrittenPerPresetPatches = new Map<string, Record<string, unknown>>(
    plan.all_presets.map((p) => [p.name, rewriteHookPaths(p.settings_patch, hooksDir)]),
  );

  // Update settings: subtract this preset's prior contribution, then apply
  // the new patch. Subtraction prefers the recorded rewritten patch value
  // (precise) and falls back to top-level-key removal for legacy manifests.
  const settingsPath = join(targetRoot, 'settings.json');
  const existingSettings = await loadSettings(settingsPath);
  let nextSettings = existingSettings;

  const removingPatch = manifest.settings_patches.find((p) => p.preset === presetName);
  if (removingPatch !== undefined) {
    if (removingPatch.patch !== undefined) {
      nextSettings = subtractSettings(nextSettings, removingPatch.patch);
    } else {
      const newPatchTopKeys = new Set(Object.keys(rewrittenMergedPatch));
      const otherPatchedKeys = new Set(
        manifest.settings_patches
          .filter((p) => p.preset !== presetName)
          .flatMap((p) => p.patch_keys),
      );
      const keysToRevert = removingPatch.patch_keys.filter(
        (k) => !newPatchTopKeys.has(k) && !otherPatchedKeys.has(k),
      );
      if (keysToRevert.length > 0) {
        nextSettings = Object.fromEntries(
          Object.entries(nextSettings).filter(([k]) => !keysToRevert.includes(k)),
        );
      }
    }
  }

  if (Object.keys(rewrittenMergedPatch).length > 0) {
    nextSettings = mergeSettings(nextSettings, rewrittenMergedPatch);
  }

  if (nextSettings !== existingSettings) {
    await writeSettings(settingsPath, nextSettings);
  }

  // Update manifest: replace this preset's entries with fresh plan data.
  const baseManifest: Manifest = {
    schema_version: 1,
    installed_at: manifest.installed_at,
    presets: manifest.presets.filter((p) => p.name !== presetName),
    components: manifest.components.filter((c) => c.preset !== presetName),
    settings_patches: manifest.settings_patches.filter((p) => p.preset !== presetName),
    external_deps: manifest.external_deps,
  };
  const additions = buildManifestAdditions(plan, mode, targetRoot, rewrittenPerPresetPatches);
  const newManifest = mergeManifest(baseManifest, additions);
  await writeManifest(manifestPath, newManifest);

  return { added, removed, updated, unchanged };
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export type AuditStatus = 'tracked' | 'untracked' | 'missing';

export interface AuditEntry {
  path: string;
  status: AuditStatus;
  component?: string;
  preset?: string;
}

const BAK_PATTERN = /\.bak\.\d{4}-\d{2}-\d{2}T/;

export async function auditTarget(targetRoot: string): Promise<AuditEntry[]> {
  const manifestPath = join(targetRoot, '.dotclaude-manifest.yaml');
  const manifest = await loadManifest(manifestPath);

  // Build lookup: target_path → {component, preset}
  const trackedByPath = new Map<string, { component: string; preset: string }>();
  if (manifest !== null) {
    for (const c of manifest.components) {
      trackedByPath.set(c.target_path, {
        component: `${c.type}:${c.id}`,
        preset: c.preset,
      });
    }
  }

  const results: AuditEntry[] = [];

  // Check manifest entries that may no longer exist on disk.
  for (const [targetPath, info] of trackedByPath) {
    let exists = true;
    try {
      await lstat(targetPath);
    } catch {
      exists = false;
    }
    if (!exists) {
      results.push({
        path: targetPath,
        status: 'missing',
        component: info.component,
        preset: info.preset,
      });
    }
  }

  // Walk each component-type subdir and classify each entry.
  for (const type of COMPONENT_TYPES) {
    const dir = join(targetRoot, type);
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (BAK_PATTERN.test(entry.name)) continue;
      const entryPath = join(dir, entry.name);
      const tracked = trackedByPath.get(entryPath);
      if (tracked !== undefined) {
        results.push({
          path: entryPath,
          status: 'tracked',
          component: tracked.component,
          preset: tracked.preset,
        });
      } else {
        results.push({ path: entryPath, status: 'untracked' });
      }
    }
  }

  return results;
}
