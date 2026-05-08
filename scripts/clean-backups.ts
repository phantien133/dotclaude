import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { Command } from 'commander';
import { backupTimestamp } from './lib/fs-ops.ts';
import { log } from './lib/logger.ts';

const BAK_PATTERN = /\.bak\.\d{4}-\d{2}-\d{2}T/;

// Scan a directory (non-recursive) for backup files matching the .bak.* pattern.
async function findBackupsInDir(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => BAK_PATTERN.test(e.name))
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}

// Scan the .claude/ subdirectory of a root for backup files.
async function findBackupsUnder(root: string): Promise<string[]> {
  const claudeDir = join(root, '.claude');
  const results: string[] = [];

  // Scan the .claude dir itself
  results.push(...(await findBackupsInDir(claudeDir)));

  // Scan each component-type subdirectory
  const COMPONENT_SUBDIRS = ['agents', 'skills', 'commands', 'hooks', 'rules'];
  for (const sub of COMPONENT_SUBDIRS) {
    results.push(...(await findBackupsInDir(join(claudeDir, sub))));
  }

  return results;
}

const program = new Command();
program
  .name('clean-backups')
  .description('Remove .bak.* files older than N days from .claude/ directories')
  .option('--days <n>', 'Delete backups older than N days (default: 30)', '30')
  .option('--dry-run', 'List backups without deleting')
  .option('--target <path>', 'Additional project root to scan (scans <target>/.claude/)')
  .action(async (opts: { days: string; dryRun?: boolean; target?: string }) => {
    const days = parseInt(opts.days, 10);
    if (isNaN(days) || days < 0) {
      log.error(`--days must be a non-negative integer (got "${opts.days}")`);
      process.exit(1);
    }

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const roots: string[] = [homedir()];
    if (opts.target !== undefined) roots.push(opts.target);

    const backups: string[] = [];
    for (const root of roots) {
      backups.push(...(await findBackupsUnder(root)));
    }

    // Check which backups are older than cutoff
    const toDelete: string[] = [];
    for (const bak of backups) {
      const ts = backupTimestamp(bak);
      if (ts === null) {
        // Can't parse timestamp — use file mtime as fallback
        try {
          const s = await stat(bak);
          if (s.mtimeMs <= cutoff) toDelete.push(bak);
        } catch {
          // file disappeared
        }
        continue;
      }
      if (ts.getTime() <= cutoff) toDelete.push(bak);
    }

    if (toDelete.length === 0) {
      log.info(`No backups older than ${days} days found.`);
      return;
    }

    for (const bak of toDelete) {
      if (opts.dryRun === true) {
        log.info(`[dry-run] would delete: ${bak}`);
      } else {
        await rm(bak, { recursive: true, force: true });
        log.info(`Deleted: ${bak}`);
      }
    }

    if (opts.dryRun !== true) {
      log.info(`Removed ${toDelete.length} backup(s).`);
    } else {
      log.info(`[dry-run] ${toDelete.length} backup(s) would be removed.`);
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
