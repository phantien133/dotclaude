import { cp, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { repoPath } from './lib/paths.ts';
import { log } from './lib/logger.ts';

const PAIRS = [
  {
    src: repoPath('claudekit', 'private.example'),
    dst: repoPath('claudekit', 'private'),
    label: 'claudekit/private/',
  },
  {
    src: repoPath('presets', 'private.example'),
    dst: repoPath('presets', 'private'),
    label: 'presets/private/',
  },
  {
    src: repoPath('plugins', 'private.example'),
    dst: repoPath('plugins', 'private'),
    label: 'plugins/private/',
  },
];

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

// Returns true if the directory exists and contains at least one non-.gitkeep file.
async function hasRealContent(dir: string): Promise<boolean> {
  if (!(await pathExists(dir))) return false;
  try {
    const entries = await readdir(dir, { recursive: true });
    return entries.some((e) => e !== '.gitkeep' && !String(e).endsWith('/.gitkeep'));
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  let initCount = 0;

  for (const { src, dst, label } of PAIRS) {
    if (!(await pathExists(src))) {
      log.warn(`Source ${label.replace('private/', 'private.example/')} not found — skipping.`);
      continue;
    }
    if (await hasRealContent(dst)) {
      log.info(`${label} already initialized — skipping.`);
      continue;
    }
    await cp(src, dst, { recursive: true });
    log.info(`Initialized ${label}`);
    initCount++;
  }

  if (initCount === 0) {
    log.info('Nothing to initialize (all private/ dirs already present).');
  } else {
    log.info(`Done. Edit the files in claudekit/private/, presets/private/, and plugins/private/ to add your own content.`);
  }
}

main().catch((err: unknown) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
