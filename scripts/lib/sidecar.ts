import { readFile, stat } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { z } from 'zod';
import { loadYaml } from './yaml.ts';
import { SidecarSchema, type Sidecar, type ComponentType } from './schema.ts';
import { CLAUDEKIT_DIR, CLAUDEKIT_PRIVATE_DIR } from './paths.ts';

export type ComponentLayout =
  | { kind: 'file'; componentPath: string; sidecarPath: string }
  | { kind: 'folder'; componentPath: string; sidecarPath: string };

export interface ComponentRef {
  type: ComponentType;
  id: string;
  scope: 'public' | 'private';
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function locateComponent(
  ref: Pick<ComponentRef, 'type' | 'id'>,
): Promise<{ scope: 'public' | 'private'; layout: ComponentLayout } | null> {
  for (const [scope, base] of [
    ['public', CLAUDEKIT_DIR],
    ['private', CLAUDEKIT_PRIVATE_DIR],
  ] as const) {
    const folderCandidate = join(base, ref.type, ref.id);
    if (await isDirectory(folderCandidate)) {
      const sidecarPath = join(folderCandidate, 'SOURCE.yaml');
      return {
        scope,
        layout: { kind: 'folder', componentPath: folderCandidate, sidecarPath },
      };
    }

    const fileBase = join(base, ref.type, ref.id);
    for (const ext of ['.md', '.json', '.sh', '.yaml', '.yml', '.ts']) {
      const fileCandidate = `${fileBase}${ext}`;
      if (await pathExists(fileCandidate)) {
        const sidecarPath = `${fileCandidate.replace(/\.[^.]+$/, '')}.source.yaml`;
        return {
          scope,
          layout: { kind: 'file', componentPath: fileCandidate, sidecarPath },
        };
      }
    }
  }

  return null;
}

export async function loadSidecar(sidecarPath: string): Promise<Sidecar> {
  const raw = await readFile(sidecarPath, 'utf8');
  const data = loadYaml(raw);
  try {
    return SidecarSchema.parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues
        .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid sidecar at ${sidecarPath}:\n${issues}`);
    }
    throw err;
  }
}

export function describeSidecarLocation(
  layout: ComponentLayout,
): { type: 'file'; relPath: string } | { type: 'folder'; folder: string; sidecar: string } {
  if (layout.kind === 'file') {
    return { type: 'file', relPath: layout.componentPath };
  }
  return {
    type: 'folder',
    folder: layout.componentPath,
    sidecar: join(basename(dirname(layout.sidecarPath)), basename(layout.sidecarPath)),
  };
}
