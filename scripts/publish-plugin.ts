import { Command } from 'commander';
import { join, relative } from 'node:path';
import { PRESET_KINDS, type PresetKind } from './lib/schema.ts';
import { buildPlugin } from './lib/plugin-build.ts';
import {
  upsertMarketplaceEntry,
  MARKETPLACE_JSON,
  MARKETPLACE_DIR,
} from './lib/marketplace.ts';
import { PLUGINS_DIR } from './lib/paths.ts';
import { log } from './lib/logger.ts';

const program = new Command();

program
  .name('publish-plugin')
  .description(
    'Build a plugin bundle and update marketplace.json.\n' +
    'To push to the marketplace repo, copy plugins/<name>/ there manually or via CI.',
  )
  .argument('<preset>', 'preset name')
  .option('--kind <kind>', `Disambiguate preset kind (${PRESET_KINDS.join(' | ')})`)
  .option('--include-optional', 'Include optional component dependencies', false)
  .option('--clean', 'Remove plugin output directory before building', false)
  .action(
    async (
      presetName: string,
      opts: { kind?: string; includeOptional: boolean; clean: boolean },
    ) => {
      const kind = opts.kind !== undefined ? validateKind(opts.kind) : undefined;

      log.info(`Publishing plugin: ${presetName}`);

      try {
        const result = await buildPlugin(presetName, {
          ...(kind !== undefined && { kind }),
          include_optional: opts.includeOptional,
          clean: opts.clean,
          author: { name: 'hilabaikit', email: 'tienpq@hilab.asia' },
          repository: 'https://gitlab.hilab.cloud/hilabaikit/dotclaude',
          license: 'MIT',
        });

        if (result.skipped.length > 0) {
          log.warn(`${result.skipped.length} component(s) skipped:`);
          for (const s of result.skipped) {
            log.warn(`  ${s}`);
          }
        }

        log.info(`Built ${result.componentCount} component(s) → ${result.outDir}`);

        // Source paths are relative to .claude-plugin/marketplace.json
        // (Claude Code resolves them from the marketplace file's location).
        const sourceRelPath = relative(MARKETPLACE_DIR, join(PLUGINS_DIR, presetName)) + '/';

        await upsertMarketplaceEntry(result.manifest, sourceRelPath);
        log.info(`Updated ${MARKETPLACE_JSON}`);

        if (result.skipped.length > 0) {
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
