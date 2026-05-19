import { Command } from 'commander';
import { join, relative } from 'node:path';
import { PRESET_KINDS, type PresetKind } from './lib/schema.ts';
import { buildPlugin } from './lib/plugin-build.ts';
import { upsertMarketplaceEntry, MARKETPLACE_JSON } from './lib/marketplace.ts';
import { REPO_ROOT, PLUGINS_DIR } from './lib/paths.ts';
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
          author: { name: 'phantien133', email: 'phanqtien@gmail.com' },
          repository: 'https://github.com/phantien133/dotclaude',
          license: 'MIT',
        });

        if (result.skipped.length > 0) {
          log.warn(`${result.skipped.length} component(s) skipped:`);
          for (const s of result.skipped) {
            log.warn(`  ${s}`);
          }
        }

        log.info(`Built ${result.componentCount} component(s) → ${result.outDir}`);

        // Source paths are relative to the repo root (NOT the marketplace
        // file dir). Claude Code resolves `./plugins/<name>` from the cloned
        // repo root, matching the convention used by claude-plugins-official.
        const sourceRelPath = './' + relative(REPO_ROOT, join(PLUGINS_DIR, presetName));

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
