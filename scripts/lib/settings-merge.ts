import { readFile, writeFile } from 'node:fs/promises';
import { backup } from './fs-ops.ts';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Rewrites hook command paths inside a settings_patch from the preset-author
// convention `~/.claude/hooks/<file>` to the install-target convention. The
// substitution is purely textual (over the JSON-serialised patch) so it
// rewrites every occurrence regardless of nesting.
export function rewriteHookPaths(
  patch: Record<string, unknown>,
  hooksDir: string,
): Record<string, unknown> {
  if (Object.keys(patch).length === 0) return patch;
  const json = JSON.stringify(patch).replace(/~\/\.claude\/hooks\//g, `${hooksDir}/`);
  return JSON.parse(json) as Record<string, unknown>;
}

// Merges two arrays, appending only items from `incoming` that are not
// structurally identical (by JSON serialisation) to any existing item.
function mergeArrayDedup(existing: unknown[], incoming: unknown[]): unknown[] {
  const seen = new Set(existing.map((item) => JSON.stringify(item)));
  const additions = incoming.filter((item) => !seen.has(JSON.stringify(item)));
  return [...existing, ...additions];
}

// Deep-merges patch into existing. Arrays are merged with deduplication
// (structural equality). Objects are recursively merged. Scalar conflicts:
// patch wins.
export function mergeSettings(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(patch)) {
    const ex = result[k];
    if (isPlainObject(ex) && isPlainObject(v)) {
      result[k] = mergeSettings(ex, v);
    } else if (Array.isArray(ex) && Array.isArray(v)) {
      result[k] = mergeArrayDedup(ex, v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// Inverse of mergeSettings: removes patch's contributions from existing.
//   - Arrays: each patch item is removed by structural (JSON) equality.
//   - Objects: recurse; if a subtree becomes empty, drop the key.
//   - Scalars: drop the key only when current value matches patch (preserves
//     manual user edits).
// Used on reinstall/upgrade/uninstall to surgically undo a previously-applied
// patch before applying the next one. Returns a new object; does not mutate.
export function subtractSettings(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in result)) continue;
    const ex = result[k];

    if (isPlainObject(ex) && isPlainObject(v)) {
      const reduced = subtractSettings(ex, v);
      if (Object.keys(reduced).length === 0) {
        delete result[k];
      } else {
        result[k] = reduced;
      }
    } else if (Array.isArray(ex) && Array.isArray(v)) {
      const toRemove = new Set(v.map((item) => JSON.stringify(item)));
      const filtered = ex.filter((item) => !toRemove.has(JSON.stringify(item)));
      if (filtered.length === 0) {
        delete result[k];
      } else {
        result[k] = filtered;
      }
    } else if (JSON.stringify(ex) === JSON.stringify(v)) {
      delete result[k];
    }
  }
  return result;
}

// Reads settings.json from path. Returns {} if missing or unreadable.
export async function loadSettings(path: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (isPlainObject(parsed)) return parsed;
    return {};
  } catch {
    return {};
  }
}

// Backs up the existing file, then writes merged settings as JSON.
export async function writeSettings(
  path: string,
  merged: Record<string, unknown>,
): Promise<void> {
  await backup(path);
  const content = JSON.stringify(merged, null, 2) + '\n';
  await writeFile(path, content, 'utf8');
}
