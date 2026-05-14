import { Command } from 'commander';
import { PRESET_KINDS, type PresetKind } from './lib/schema.ts';
import { buildPlugin } from './lib/plugin-build.ts';
import { log } from './lib/logger.ts';

const program = new Command();

program
  .name('build-plugin')
  .description('Build a self-contained Claude Code plugin bundle from a preset')
  .argument('<preset>', 'preset name')
  .option('--kind <kind>', `Disambiguate preset kind (${PRESET_KINDS.join(' | ')})`)
  .option('--out <dir>', 'Output directory (default: plugins/<preset>)')
  .option('--include-optional', 'Include optional component dependencies', false)
  .option('--clean', 'Remove output directory before building', false)
  .action(
    async (
      presetName: string,
      opts: { kind?: string; out?: string; includeOptional: boolean; clean: boolean },
    ) => {
      const kind = opts.kind !== undefined ? validateKind(opts.kind) : undefined;

      log.info(`Building plugin: ${presetName}`);

      try {
        const result = await buildPlugin(presetName, {
          ...(kind !== undefined && { kind }),
          ...(opts.out !== undefined && { outDir: opts.out }),
          include_optional: opts.includeOptional,
          clean: opts.clean,
          author: { name: 'hilabaikit', email: 'tienpq@hilab.asia' },
          repository: 'https://gitlab.hilab.cloud/hilabaikit/dotclaude',
          license: 'MIT',
        });

        log.info(`Built ${result.componentCount} component(s) → ${result.outDir}`);
        log.info(`Manifest: ${result.outDir}/.claude-plugin/plugin.json`);

        if (result.skipped.length > 0) {
          log.warn(`${result.skipped.length} component(s) skipped:`);
          for (const s of result.skipped) {
            log.warn(`  ${s}`);
          }
          process.exit(1);
        }
      } catch (err) {
        log.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    },
  );

function validateKind(s: string): PresetKind {
  if (!(PRESET_KINDS as readonly string[]).includes(s)) {
    log.error(`Invalid kind "${s}". Expected: ${PRESET_KINDS.join(' | ')}`);
    process.exit(1);
  }
  return s as PresetKind;
}

program.parse();
