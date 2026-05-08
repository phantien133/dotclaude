import { readFile, writeFile } from 'node:fs/promises';
import { backup } from './fs-ops.ts';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Deep-merges patch into existing. Arrays are concatenated. Objects are recursively
// merged. Scalar conflicts: patch wins.
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
      result[k] = [...ex, ...v];
    } else {
      result[k] = v;
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
