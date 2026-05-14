import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { CLAUDEKIT_SOURCES, type ClaudekitSource } from './schema.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');

export const CLAUDEKIT_DIR = join(REPO_ROOT, 'claudekit');
export const PRESETS_DIR = join(REPO_ROOT, 'presets');
export const PRESETS_PRIVATE_DIR = join(REPO_ROOT, 'presets', 'private');
export const PRESETS_SCHEMA_DIR = join(REPO_ROOT, 'presets', 'schema');
export const PLUGINS_DIR = join(REPO_ROOT, 'plugins');
export const UPSTREAM_DIR = join(REPO_ROOT, 'upstream');

export const DEPENDENCIES_YAML = join(REPO_ROOT, 'dependencies.yaml');

// Map each source alias to its on-disk root under claudekit/.
// The three dotclaude-* aliases live under a shared claudekit/dotclaude/ parent
// so the filesystem reflects that they are all from phantien133/dotclaude.
const SOURCE_TO_RELATIVE_PATH: Record<ClaudekitSource, string> = {
  'everything-claude-code': 'everything-claude-code',
  'anthropic-skills': 'anthropic-skills',
  'dotclaude-self': 'dotclaude/dotclaude-self',
  'workflow': 'dotclaude/workflow',
  'figma': 'dotclaude/figma',
  'private': 'private',
};

export function claudekitSourceDir(source: ClaudekitSource): string {
  return join(CLAUDEKIT_DIR, SOURCE_TO_RELATIVE_PATH[source]);
}

// All known source dirs (including private/), in resolver scan order.
export const CLAUDEKIT_SOURCE_DIRS: ReadonlyArray<{ source: ClaudekitSource; dir: string }> =
  CLAUDEKIT_SOURCES.map((source) => ({ source, dir: claudekitSourceDir(source) }));

export function repoPath(...segments: string[]): string {
  return join(REPO_ROOT, ...segments);
}
