import { Command } from 'commander';
import { COMPONENT_TYPES, PRESET_KINDS, type ComponentType, type PresetKind } from './lib/schema.ts';
import { locateComponent, loadSidecar } from './lib/sidecar.ts';
import { locatePreset, listAllPresets } from './lib/preset.ts';
import { log } from './lib/logger.ts';

const program = new Command();
program
  .name('dotclaude')
  .description('dotclaude installer (Phase 1: validate + list)');

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

program
  .command('user')
  .description('Install preset at user level (~/.claude/) — Phase 2')
  .argument('<preset>', 'preset name')
  .action((preset: string) => {
    log.warn(`install user "${preset}": not yet implemented (Phase 2).`);
    log.info('Phase 1 supports only `validate` and `list` subcommands.');
    process.exit(2);
  });

program
  .command('project')
  .description('Install preset at project level (<cwd>/.claude/) — Phase 2')
  .argument('<preset>', 'preset name')
  .action((preset: string) => {
    log.warn(`install project "${preset}": not yet implemented (Phase 2).`);
    log.info('Phase 1 supports only `validate` and `list` subcommands.');
    process.exit(2);
  });

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
