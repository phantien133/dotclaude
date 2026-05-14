import { readFile, stat } from 'node:fs/promises';
import { join, dirname, basename, relative } from 'node:path';
import { z } from 'zod';
import { loadYaml } from './yaml.ts';
import { SidecarSchema, type Sidecar, type ComponentType, type ClaudekitSource } from './schema.ts';
import { CLAUDEKIT_DIR, CLAUDEKIT_SOURCE_DIRS, claudekitSourceDir } from './paths.ts';

export type ComponentLayout =
  | { kind: 'file'; componentPath: string; sidecarPath: string }
  | { kind: 'folder'; componentPath: string; sidecarPath: string };

export interface ComponentRef {
  type: ComponentType;
  id: string;
  source: ClaudekitSource;
}

const FILE_EXTS = ['.md', '.json', '.sh', '.yaml', '.yml', '.ts', '.js', '.py'];

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

interface LocateInput {
  type: ComponentType;
  id: string;
  source?: ClaudekitSource;
}

interface LocateResult {
  source: ClaudekitSource;
  layout: ComponentLayout;
}

// Resolves the on-disk layout for a component. When `source` is given, look only
// in claudekit/<source>/<type>/<id>. When omitted, scan all sources in order and
// throw if more than one matches.
export async function locateComponent(ref: LocateInput): Promise<LocateResult | null> {
  if (ref.source !== undefined) {
    const layout = await tryLocateInSource(ref.source, ref.type, ref.id);
    return layout ? { source: ref.source, layout } : null;
  }

  const matches: LocateResult[] = [];
  for (const { source, dir } of CLAUDEKIT_SOURCE_DIRS) {
    void dir;
    const layout = await tryLocateInSource(source, ref.type, ref.id);
    if (layout !== null) matches.push({ source, layout });
  }
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;
  const where = matches.map((m) => relative(CLAUDEKIT_DIR, m.layout.componentPath));
  throw new Error(
    `Ambiguous component ${ref.type}:${ref.id} — found in ${matches.length} sources: ${where.join(', ')}. Pin one with \`source:\` in preset.yaml or rename to disambiguate.`,
  );
}

async function tryLocateInSource(
  source: ClaudekitSource,
  type: ComponentType,
  id: string,
): Promise<ComponentLayout | null> {
  const base = claudekitSourceDir(source);
  const folderCandidate = join(base, type, id);
  if (await isDirectory(folderCandidate)) {
    return {
      kind: 'folder',
      componentPath: folderCandidate,
      sidecarPath: join(folderCandidate, 'SOURCE.yaml'),
    };
  }

  const fileBase = join(base, type, id);
  for (const ext of FILE_EXTS) {
    const fileCandidate = `${fileBase}${ext}`;
    if (await pathExists(fileCandidate)) {
      return {
        kind: 'file',
        componentPath: fileCandidate,
        sidecarPath: `${fileCandidate.replace(/\.[^.]+$/, '')}.source.yaml`,
      };
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
