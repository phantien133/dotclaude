import {
  copyFile,
  cp,
  lstat,
  mkdir,
  readdir,
  readlink,
  rm,
  symlink,
} from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import type { PlannedComponent } from './resolver.ts';

export type InstallMode = 'symlink' | 'copy';
export type ConflictPolicy = 'backup-overwrite' | 'skip' | 'overwrite';
export type ApplyResult = 'installed' | 'skipped' | 'idempotent';

export function componentTargetPath(component: PlannedComponent, targetRoot: string): string {
  const { type, id, layout } = component;
  if (layout.kind === 'folder') {
    return join(targetRoot, type, id);
  }
  const ext = extname(layout.componentPath);
  return join(targetRoot, type, `${id}${ext}`);
}

function guardTargetPath(dst: string, targetRoot: string): void {
  const resolved = resolve(dst);
  const rootResolved = resolve(targetRoot);
  if (!resolved.startsWith(rootResolved + sep) && resolved !== rootResolved) {
    throw new Error(
      `Path traversal detected: "${dst}" is outside target root "${targetRoot}"`,
    );
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await lstat(p);
    return true;
  } catch {
    return false;
  }
}

async function isSymlinkTo(dst: string, src: string): Promise<boolean> {
  try {
    const link = await readlink(dst);
    return link === src;
  } catch {
    return false;
  }
}

// Creates a timestamped .bak copy of a path if it exists.
export async function backup(path: string): Promise<string | null> {
  if (!(await pathExists(path))) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${path}.bak.${ts}`;
  await cp(path, backupPath, { recursive: true });
  return backupPath;
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function copyFolderExcluding(
  src: string,
  dst: string,
  exclude: string[],
): Promise<void> {
  await ensureDir(dst);
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue;
    const srcPath = join(src, entry.name);
    const dstPath = join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyFolderExcluding(srcPath, dstPath, exclude);
    } else {
      await copyFile(srcPath, dstPath);
    }
  }
}

export async function applyComponent(
  src: string,
  dst: string,
  mode: InstallMode,
  conflictPolicy: ConflictPolicy,
  layoutKind: 'file' | 'folder',
  targetRoot: string,
): Promise<ApplyResult> {
  guardTargetPath(dst, targetRoot);

  // Idempotency: already installed in the correct mode pointing to same src.
  if (mode === 'symlink' && (await isSymlinkTo(dst, src))) {
    return 'idempotent';
  }
  if (mode === 'copy') {
    try {
      const s = await lstat(dst);
      if (!s.isSymbolicLink()) return 'idempotent';
    } catch {
      // dst doesn't exist — proceed with install
    }
  }

  if (await pathExists(dst)) {
    if (conflictPolicy === 'skip') return 'skipped';
    if (conflictPolicy === 'backup-overwrite') await backup(dst);
    await rm(dst, { recursive: true, force: true });
  }

  if (mode === 'symlink') {
    await symlink(src, dst);
  } else {
    if (layoutKind === 'folder') {
      await copyFolderExcluding(src, dst, ['SOURCE.yaml']);
    } else {
      await copyFile(src, dst);
    }
  }

  return 'installed';
}

// Find all *.bak.<timestamp> files under a directory (non-recursive).
export async function findBackupFiles(dir: string): Promise<string[]> {
  const BAK_PATTERN = /\.bak\.\d{4}-\d{2}-\d{2}T/;
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (BAK_PATTERN.test(entry.name)) {
        results.push(join(dir, entry.name));
      }
    }
  } catch {
    // directory may not exist
  }
  return results;
}

// Extract ISO timestamp from a backup filename for age comparison.
export function backupTimestamp(filePath: string): Date | null {
  const match = /\.bak\.(\d{4}-\d{2}-\d{2}T[\d-]+)$/.exec(filePath);
  if (!match || match[1] === undefined) return null;
  // Restore colons that were replaced during naming
  const iso = match[1].replace(
    /^(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})-(\d{3})Z?$/,
    '$1$2:$3:$4.$5Z',
  );
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
