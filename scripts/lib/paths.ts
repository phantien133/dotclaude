import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');

export const CLAUDEKIT_DIR = join(REPO_ROOT, 'claudekit');
export const CLAUDEKIT_PRIVATE_DIR = join(REPO_ROOT, 'claudekit', 'private');
export const PRESETS_DIR = join(REPO_ROOT, 'presets');
export const PRESETS_PRIVATE_DIR = join(REPO_ROOT, 'presets', 'private');
export const PRESETS_SCHEMA_DIR = join(REPO_ROOT, 'presets', 'schema');
export const PLUGINS_DIR = join(REPO_ROOT, 'plugins');
export const UPSTREAM_DIR = join(REPO_ROOT, 'upstream');

export const DEPENDENCIES_YAML = join(REPO_ROOT, 'dependencies.yaml');

export function repoPath(...segments: string[]): string {
  return join(REPO_ROOT, ...segments);
}
