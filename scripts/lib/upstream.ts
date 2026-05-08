import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { loadYaml } from './yaml.ts';
import { DEPENDENCIES_YAML, repoPath } from './paths.ts';

const SourceEntrySchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    repo: z.string().url(),
    local_path: z.string().min(1),
    pinned_commit: z.string().nullable(),
    ref: z.string().min(1),
    role: z.enum(['sync_source', 'docs', 'runtime']),
    license: z.string().optional(),
  })
  .strict();
export type UpstreamSource = z.infer<typeof SourceEntrySchema>;

const DependenciesFileSchema = z
  .object({
    version: z.number(),
    sources: z.record(z.string(), SourceEntrySchema),
  })
  .strict();

let cache: { sources: Record<string, UpstreamSource> } | null = null;

export async function loadUpstreamSources(): Promise<Record<string, UpstreamSource>> {
  if (cache) return cache.sources;
  const raw = await readFile(DEPENDENCIES_YAML, 'utf8');
  const parsed = DependenciesFileSchema.parse(loadYaml(raw));
  cache = { sources: parsed.sources };
  return cache.sources;
}

export async function resolveSourceByRepoUrl(
  repoUrl: string,
): Promise<{ key: string; entry: UpstreamSource; absolutePath: string } | null> {
  const sources = await loadUpstreamSources();
  for (const [key, entry] of Object.entries(sources)) {
    if (normalizeRepoUrl(entry.repo) === normalizeRepoUrl(repoUrl)) {
      return { key, entry, absolutePath: repoPath(entry.local_path) };
    }
  }
  return null;
}

function normalizeRepoUrl(url: string): string {
  return url.replace(/\.git$/, '').replace(/\/+$/, '').toLowerCase();
}
