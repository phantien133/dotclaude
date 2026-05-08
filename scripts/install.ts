import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { Command } from 'commander';
import { COMPONENT_TYPES, PRESET_KINDS, type ComponentType, type PresetKind } from './lib/schema.ts';
import { locateComponent, loadSidecar } from './lib/sidecar.ts';
import { locatePreset, listAllPresets } from './lib/preset.ts';
import { buildInstallPlan, type PlannedComponent } from './lib/resolver.ts';
import { applyComponent, ensureDir, componentTargetPath, type InstallMode, type ConflictPolicy } from './lib/fs-ops.ts';
import { loadSettings, writeSettings, mergeSettings } from './lib/settings-merge.ts';
import { loadManifest, writeManifest, buildManifestAdditions, mergeManifest } from './lib/manifest.ts';
import { log } from './lib/logger.ts';
import { uninstallPreset, upgradePreset, auditTarget } from './lib/lifecycle.ts';

const program = new Command();
program
  .name('dotclaude')
  .description('dotclaude installer');

// ── list ──────────────────────────────────────────────────────────────────────

program
  .command('list')
  .description('List presets from public + private scopes')
  .option('--kind <kind>', `Filter by kind (${PRESET_KINDS.join(' | ')})`)
  .action(async (opts: { kind?: string }) => {
    const kind = opts.kind ? validateKind(opts.kind) : undefined;
    const entries = await listAllPresets(kind ? { kind } : {});
    if (entries.length === 0) {
      log.warn('No presets found.');
      return;
    }
    for (const entry of entries) {
      const tagPart = entry.preset.tags.length > 0 ? `  [${entry.preset.tags.join(', ')}]` : '';
      const scopeMark = entry.scope === 'private' ? ' (private)' : '';
      log.raw(
        `${entry.kind.padEnd(9)} ${entry.name.padEnd(28)} v${entry.preset.version}${scopeMark}${tagPart}`,
      );
      log.raw(`          ${entry.preset.description}`);
    }
  });

// ── validate ──────────────────────────────────────────────────────────────────

program
  .command('validate')
  .description('Validate a preset: schema + component references + sidecar integrity')
  .argument('<name>', 'preset name')
  .option('--kind <kind>', `Disambiguate (${PRESET_KINDS.join(' | ')})`)
  .action(async (name: string, opts: { kind?: string }) => {
    const kind = opts.kind ? validateKind(opts.kind) : undefined;
    let exitCode = 0;

    const located = await locatePreset(name, kind ? { kind } : {});
    log.info(`Preset: ${located.preset.name} (kind=${located.preset.kind}, scope=${located.scope})`);
    log.info(`File:   ${located.yamlPath}`);
    if (!located.mdPath) {
      log.warn(`Missing companion .md docs (expected ${located.preset.name}.md alongside YAML).`);
      exitCode = Math.max(exitCode, 1);
    }

    if (located.preset.extends.length > 0) {
      log.info(`Extends: ${located.preset.extends.join(', ')}`);
      for (const parentName of located.preset.extends) {
        try {
          await locatePreset(parentName);
          log.info(`  ✓ extends parent "${parentName}" resolves`);
        } catch (err) {
          log.error(
            `  ✗ extends parent "${parentName}" not found: ${err instanceof Error ? err.message : String(err)}`,
          );
          exitCode = 2;
        }
      }
    }

    let componentCount = 0;
    let componentErrors = 0;
    for (const type of COMPONENT_TYPES) {
      const ids = located.preset.components[type];
      for (const id of ids) {
        componentCount++;
        const lookup = await locateComponent({ type, id });
        if (!lookup) {
          log.error(`  ✗ ${type}/${id} not found in claudekit/ (public or private)`);
          componentErrors++;
          exitCode = 2;
          continue;
        }
        try {
          await loadSidecar(lookup.layout.sidecarPath);
          log.info(`  ✓ ${type}/${id} (scope=${lookup.scope}, ${lookup.layout.kind})`);
        } catch (err) {
          log.error(
            `  ✗ ${type}/${id} sidecar invalid: ${err instanceof Error ? err.message : String(err)}`,
          );
          componentErrors++;
          exitCode = 2;
        }
      }
    }

    if (componentCount === 0) {
      log.warn('Preset declares zero components.');
    } else {
      log.info(`Components checked: ${componentCount} (errors: ${componentErrors})`);
    }

    if (exitCode === 0) {
      log.info('VALID');
    } else if (exitCode === 1) {
      log.warn('VALID WITH WARNINGS');
    } else {
      log.error('INVALID');
    }
    process.exit(exitCode);
  });

// ── install:user ──────────────────────────────────────────────────────────────

program
  .command('user')
  .description('Install preset at user level (~/.claude/)')
  .argument('<preset>', 'preset name')
  .option('--kind <kind>', `Disambiguate preset kind (${PRESET_KINDS.join(' | ')})`)
  .option('--copy', 'Copy files instead of symlinking')
  .option('--symlink', 'Symlink files instead of copying')
  .option('--force', 'Overwrite conflicts in-place (no backup)')
  .option('--skip-existing', 'Skip files that already exist at target')
  .option('--include-optional', 'Also install optional component deps')
  .option('--dry-run', 'Print what would be installed without making changes')
  .option('--target <path>', 'Override install root (default: ~/.claude)')
  .action(async (presetName: string, opts: UserInstallOpts) => {
    const targetRoot = opts.target ?? join(homedir(), '.claude');
    await runInstall(presetName, targetRoot, opts, 'user');
  });

// ── install:project ───────────────────────────────────────────────────────────

program
  .command('project')
  .description('Install preset at project level (<cwd>/.claude/)')
  .argument('<preset>', 'preset name')
  .option('--kind <kind>', `Disambiguate preset kind (${PRESET_KINDS.join(' | ')})`)
  .option('--symlink', 'Symlink files instead of copying')
  .option('--copy', 'Copy files instead of symlinking')
  .option('--force', 'Overwrite conflicts in-place (no backup)')
  .option('--skip-existing', 'Skip files that already exist at target')
  .option('--include-optional', 'Also install optional component deps')
  .option('--dry-run', 'Print what would be installed without making changes')
  .option('--target <path>', 'Override project root (default: <cwd>)')
  .action(async (presetName: string, opts: ProjectInstallOpts) => {
    const projectRoot = opts.target ?? process.cwd();
    const targetRoot = join(projectRoot, '.claude');
    await runInstall(presetName, targetRoot, opts, 'project');
  });

// ── shared install logic ──────────────────────────────────────────────────────

interface UserInstallOpts {
  kind?: string;
  copy?: boolean;
  symlink?: boolean;
  force?: boolean;
  skipExisting?: boolean;
  includeOptional?: boolean;
  dryRun?: boolean;
  target?: string;
}

interface ProjectInstallOpts extends UserInstallOpts {
  // same flags, different defaults
}

async function promptInstallMode(): Promise<InstallMode> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('Install mode? [symlink/copy]: ');
    const normalized = answer.trim().toLowerCase();
    if (normalized === 'symlink' || normalized === 's') return 'symlink';
    if (normalized === 'copy' || normalized === 'c') return 'copy';
    log.warn(`Unknown input "${answer}", defaulting to copy`);
    return 'copy';
  } finally {
    rl.close();
  }
}

async function runInstall(
  presetName: string,
  targetRoot: string,
  opts: UserInstallOpts,
  scope: 'user' | 'project',
): Promise<void> {
  const mode: InstallMode = opts.copy === true
    ? 'copy'
    : opts.symlink === true
      ? 'symlink'
      : await promptInstallMode();

  const conflictPolicy: ConflictPolicy = opts.force === true
    ? 'overwrite'
    : opts.skipExisting === true
      ? 'skip'
      : 'backup-overwrite';

  const kind = opts.kind ? validateKind(opts.kind) : undefined;

  log.info(`Building install plan for "${presetName}"…`);

  let plan;
  try {
    const resolveOpts: Parameters<typeof buildInstallPlan>[1] = {};
    if (kind !== undefined) resolveOpts.kind = kind;
    if (opts.includeOptional === true) resolveOpts.include_optional = true;
    plan = await buildInstallPlan(presetName, resolveOpts);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (opts.dryRun === true) {
    printDryRun(plan.preset.name, plan.components, mode, targetRoot, plan.merged_settings_patch);
    return;
  }

  // Ensure all target type directories exist.
  for (const type of COMPONENT_TYPES) {
    await ensureDir(join(targetRoot, type));
  }

  const stats = { installed: 0, skipped: 0, idempotent: 0 };

  for (const component of plan.components) {
    const src = component.layout.componentPath;
    const dst = componentTargetPath(component, targetRoot);
    const layoutKind = component.layout.kind;

    try {
      const result = await applyComponent(src, dst, mode, conflictPolicy, layoutKind, targetRoot);
      stats[result]++;
      if (result === 'installed') {
        const verb = (layoutKind === 'folder' || mode === 'symlink') ? 'linked' : 'copied';
        log.info(`  ${verb}: ${component.type}/${component.id}`);
      } else if (result === 'skipped') {
        log.warn(`  skipped (conflict): ${component.type}/${component.id}`);
      }
    } catch (err) {
      log.error(
        `  failed: ${component.type}/${component.id} — ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  }

  // Apply settings patch.
  if (Object.keys(plan.merged_settings_patch).length > 0) {
    const settingsPath = join(targetRoot, 'settings.json');
    const existing = await loadSettings(settingsPath);
    const merged = mergeSettings(existing, plan.merged_settings_patch);
    await writeSettings(settingsPath, merged);
    log.info('  settings.json updated');
  }

  // Write manifest.
  const manifestPath = join(targetRoot, '.dotclaude-manifest.yaml');
  const existingManifest = await loadManifest(manifestPath);
  const additions = buildManifestAdditions(plan, mode, targetRoot);
  const newManifest = mergeManifest(existingManifest, additions);
  await writeManifest(manifestPath, newManifest);

  // External dep warnings.
  for (const probe of plan.external_warnings) {
    if (!probe.found) {
      const reason = probe.reason !== undefined ? ` (${probe.reason})` : '';
      log.warn(`  missing external dep: ${probe.name} [${probe.type}]${reason}`);
    }
  }

  if (scope === 'project') {
    log.warn(`Consider adding to your project .gitignore:\n  .claude/.dotclaude-manifest.yaml`);
  }

  log.info(
    `Installed "${presetName}" → ${targetRoot}` +
    ` (${stats.installed} installed, ${stats.idempotent} already up-to-date, ${stats.skipped} skipped)`,
  );
}

function printDryRun(
  presetName: string,
  components: PlannedComponent[],
  mode: InstallMode,
  targetRoot: string,
  settingsPatch: Record<string, unknown>,
): void {
  log.raw(`[dry-run] Preset: ${presetName}`);
  log.raw(`[dry-run] Target: ${targetRoot}`);
  log.raw(`[dry-run] Mode:   ${mode}`);
  log.raw('');
  log.raw('[dry-run] Components:');
  for (const c of components) {
    const dst = componentTargetPath(c, targetRoot);
    const depNote = c.auto_included ? ` (auto-dep, req: ${c.required_by.join(', ')})` : '';
    log.raw(`  ${mode.padEnd(7)} ${c.type}/${c.id} → ${dst}${depNote}`);
  }
  if (Object.keys(settingsPatch).length > 0) {
    log.raw('');
    log.raw('[dry-run] Settings patch keys: ' + Object.keys(settingsPatch).join(', '));
  }
}

// ── uninstall ─────────────────────────────────────────────────────────────────

interface UninstallOpts {
  target?: string;
  dryRun?: boolean;
}

program
  .command('uninstall')
  .description('Remove an installed preset from the target (default: ~/.claude)')
  .argument('<preset>', 'preset name')
  .option('--target <path>', 'Override target root (default: ~/.claude)')
  .option('--dry-run', 'Print what would be removed without making changes')
  .action(async (presetName: string, opts: UninstallOpts) => {
    const targetRoot = opts.target ?? join(homedir(), '.claude');
    try {
      const uninstallOpts: Parameters<typeof uninstallPreset>[2] = {};
      if (opts.dryRun === true) uninstallOpts.dryRun = true;
      const result = await uninstallPreset(presetName, targetRoot, uninstallOpts);
      if (opts.dryRun === true) {
        log.raw(`[dry-run] Preset: ${presetName}`);
        log.raw(`[dry-run] Target: ${targetRoot}`);
        log.raw(`[dry-run] Components to remove (${result.removed.length}):`);
        for (const key of result.removed) log.raw(`  - ${key}`);
        if (result.settingsReverted.length > 0) {
          log.raw(`[dry-run] Settings keys to revert: ${result.settingsReverted.join(', ')}`);
        }
        if (result.settingsKept.length > 0) {
          log.raw(`[dry-run] Settings keys kept (shared): ${result.settingsKept.join(', ')}`);
        }
      } else {
        log.info(
          `Uninstalled "${presetName}" from ${targetRoot}` +
          ` (removed ${result.removed.length} component(s))`,
        );
        if (result.settingsReverted.length > 0) {
          log.info(`  settings reverted: ${result.settingsReverted.join(', ')}`);
        }
        if (result.settingsKept.length > 0) {
          log.warn(`  settings kept (shared): ${result.settingsKept.join(', ')}`);
        }
      }
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── upgrade ───────────────────────────────────────────────────────────────────

interface UpgradeCmdOpts {
  target?: string;
  copy?: boolean;
  symlink?: boolean;
  includeOptional?: boolean;
  dryRun?: boolean;
  kind?: string;
}

program
  .command('upgrade')
  .description('Upgrade an installed preset to the latest claudekit version')
  .argument('<preset>', 'preset name')
  .option('--target <path>', 'Override target root (default: ~/.claude)')
  .option('--copy', 'Copy files instead of symlinking (default: symlink)')
  .option('--symlink', 'Symlink files (default)')
  .option('--include-optional', 'Also upgrade optional component deps')
  .option('--dry-run', 'Print what would change without making changes')
  .option('--kind <kind>', `Disambiguate preset kind (${PRESET_KINDS.join(' | ')})`)
  .action(async (presetName: string, opts: UpgradeCmdOpts) => {
    const targetRoot = opts.target ?? join(homedir(), '.claude');
    const mode: InstallMode = opts.copy === true ? 'copy' : 'symlink';
    const kind = opts.kind !== undefined ? validateKind(opts.kind) : undefined;
    try {
      const upgradeOpts: Parameters<typeof upgradePreset>[2] = { mode };
      if (opts.dryRun === true) upgradeOpts.dryRun = true;
      if (opts.includeOptional === true) upgradeOpts.includeOptional = true;
      if (kind !== undefined) upgradeOpts.kind = kind;
      const result = await upgradePreset(presetName, targetRoot, upgradeOpts);
      if (opts.dryRun === true) {
        log.raw(`[dry-run] Upgrade: ${presetName}`);
        log.raw(`[dry-run] Target: ${targetRoot}`);
        if (result.added.length > 0) log.raw(`  add:       ${result.added.join(', ')}`);
        if (result.removed.length > 0) log.raw(`  remove:    ${result.removed.join(', ')}`);
        if (result.updated.length > 0) log.raw(`  update:    ${result.updated.join(', ')}`);
        if (result.unchanged.length > 0) log.raw(`  unchanged: ${result.unchanged.join(', ')}`);
      } else {
        log.info(
          `Upgraded "${presetName}" → ${targetRoot}` +
          ` (added: ${result.added.length}, removed: ${result.removed.length},` +
          ` updated: ${result.updated.length}, unchanged: ${result.unchanged.length})`,
        );
      }
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── audit ─────────────────────────────────────────────────────────────────────

program
  .command('audit')
  .description('Scan target for files not managed by dotclaude, and manifest entries missing on disk')
  .option('--target <path>', 'Override target root (default: ~/.claude)')
  .action(async (opts: { target?: string }) => {
    const targetRoot = opts.target ?? join(homedir(), '.claude');
    try {
      const entries = await auditTarget(targetRoot);
      const untracked = entries.filter((e) => e.status === 'untracked');
      const missing = entries.filter((e) => e.status === 'missing');
      const tracked = entries.filter((e) => e.status === 'tracked');

      log.raw(`Audit: ${targetRoot}`);
      log.raw(`  Tracked:   ${tracked.length}`);
      log.raw(`  Untracked: ${untracked.length}`);
      log.raw(`  Missing:   ${missing.length}`);

      if (untracked.length > 0) {
        log.raw('');
        log.raw('Untracked (not managed by dotclaude):');
        for (const e of untracked) log.raw(`  [UNTRACKED] ${e.path}`);
      }

      if (missing.length > 0) {
        log.raw('');
        log.raw('Missing (in manifest but absent on disk):');
        for (const e of missing) {
          log.raw(
            `  [MISSING]   ${e.path}  (${e.component ?? '?'} from preset "${e.preset ?? '?'}")`,
          );
        }
      }

      if (untracked.length === 0 && missing.length === 0 && tracked.length > 0) {
        log.info('All tracked components are present. No untracked files found.');
      }
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── helpers ────────────────────────────────────────────────────────────────────

function validateKind(raw: string): PresetKind {
  if (!(PRESET_KINDS as readonly string[]).includes(raw)) {
    throw new Error(`--kind must be one of: ${PRESET_KINDS.join(', ')} (got "${raw}")`);
  }
  return raw as PresetKind;
}

// Suppress unused-warning about ComponentType import (kept for future extensions)
type _Unused = ComponentType;

program.parseAsync(process.argv).catch((err: unknown) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
