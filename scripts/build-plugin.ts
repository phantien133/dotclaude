import { cp, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { Command } from 'commander';
import { PRESET_KINDS, type PresetKind } from './lib/schema.ts';
import { buildPlugin, type PluginManifest } from './lib/plugin-build.ts';
import { PLUGINS_DIR, REPO_ROOT } from './lib/paths.ts';
import { appendArchiveEntry, upsertMarketplaceEntry } from './lib/marketplace.ts';
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
      const outDir = opts.out ?? join(PLUGINS_DIR, presetName);

      log.info(`Building plugin: ${presetName}`);

      try {
        // ── Archive old version before build (if version changed) ────────────
        const oldManifest = await readOldManifest(outDir);

        if (oldManifest !== null) {
          const archiveDir = join(PLUGINS_DIR, `${presetName}@${oldManifest.version}`);
          // Only archive if the directory doesn't already exist (idempotent).
          try {
            await readFile(join(archiveDir, '.claude-plugin', 'plugin.json'), 'utf8');
            log.debug(`Archive ${presetName}@${oldManifest.version} already exists — skipping copy`);
          } catch {
            log.info(`Archiving ${presetName}@${oldManifest.version} → ${archiveDir}`);
            await cp(outDir, archiveDir, { recursive: true });
          }
          // Add archive entry to marketplace.json (no-op if already present).
          const archiveRelPath = `./${relative(REPO_ROOT, archiveDir)}`;
          await appendArchiveEntry(oldManifest, archiveRelPath);
          log.info(`Marketplace: archived ${presetName}@${oldManifest.version}`);
        }

        // ── Build ─────────────────────────────────────────────────────────────
        const result = await buildPlugin(presetName, {
          ...(kind !== undefined && { kind }),
          outDir,
          include_optional: opts.includeOptional,
          clean: opts.clean,
          author: { name: 'phantien133', email: 'phanqtien@gmail.com' },
          repository: 'https://github.com/phantien133/dotclaude',
          license: 'MIT',
        });

        log.info(`Built ${result.componentCount} component(s) → ${result.outDir}`);
        log.info(`Manifest: ${result.outDir}/.claude-plugin/plugin.json`);

        // ── Update marketplace.json (latest entry) ────────────────────────────
        const latestRelPath = `./${relative(REPO_ROOT, result.outDir)}`;
        await upsertMarketplaceEntry(result.manifest, latestRelPath);
        log.info(`Marketplace: updated ${presetName}@${result.manifest.version}`);

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

async function readOldManifest(pluginDir: string): Promise<PluginManifest | null> {
  try {
    const raw = await readFile(join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf8');
    return JSON.parse(raw) as PluginManifest;
  } catch {
    return null;
  }
}

function validateKind(s: string): PresetKind {
  if (!(PRESET_KINDS as readonly string[]).includes(s)) {
    log.error(`Invalid kind "${s}". Expected: ${PRESET_KINDS.join(' | ')}`);
    process.exit(1);
  }
  return s as PresetKind;
}

program.parse();
