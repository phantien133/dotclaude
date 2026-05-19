import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { REPO_ROOT } from './paths.ts';
import type { PluginManifest } from './plugin-build.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MarketplacePlugin {
  name: string;
  source: string;
  description: string;
  version: string;
  author: PluginManifest['author'];
  homepage?: string;
  repository?: string;
  license: string;
  keywords: string[];
  category: string;
  tags: string[];
  strict: boolean;
}

export interface MarketplaceIndex {
  name: string;
  owner: {
    name: string;
    email?: string;
  };
  metadata: {
    description: string;
  };
  plugins: MarketplacePlugin[];
}

// ── Paths ─────────────────────────────────────────────────────────────────────

// Claude Code resolves marketplaces at `.claude-plugin/marketplace.json` from
// the repo root. Plugin `source` paths inside are relative to THIS file's dir,
// so a plugin at `plugins/foo/` is referenced as `../plugins/foo/`.
export const MARKETPLACE_JSON = join(REPO_ROOT, '.claude-plugin', 'marketplace.json');
export const MARKETPLACE_DIR = dirname(MARKETPLACE_JSON);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readMarketplace(): Promise<MarketplaceIndex> {
  try {
    const raw = await readFile(MARKETPLACE_JSON, 'utf8');
    return JSON.parse(raw) as MarketplaceIndex;
  } catch {
    return {
      name: 'dotclaude',
      owner: { name: 'phantien133', email: 'phanqtien@gmail.com' },
      metadata: { description: 'phantien133 Claude Code plugin marketplace for claudekit presets.' },
      plugins: [],
    };
  }
}

async function writeMarketplace(index: MarketplaceIndex): Promise<void> {
  await mkdir(MARKETPLACE_DIR, { recursive: true });
  await writeFile(MARKETPLACE_JSON, JSON.stringify(index, null, 2) + '\n', 'utf8');
}

export function manifestToMarketplacePlugin(
  manifest: PluginManifest,
  sourceRelPath: string,
): MarketplacePlugin {
  const plugin: MarketplacePlugin = {
    name: manifest.name,
    source: sourceRelPath,
    description: manifest.description,
    version: manifest.version,
    author: manifest.author,
    license: manifest.license,
    keywords: manifest.keywords,
    category: 'workflow',
    tags: manifest.keywords,
    strict: false,
  };
  if (manifest.homepage !== undefined) plugin.homepage = manifest.homepage;
  if (manifest.repository !== undefined) plugin.repository = manifest.repository;
  return plugin;
}

// Upsert: replace existing entry for the same plugin name, or append.
export async function upsertMarketplaceEntry(
  manifest: PluginManifest,
  sourceRelPath: string,
): Promise<MarketplaceIndex> {
  const index = await readMarketplace();
  const entry = manifestToMarketplacePlugin(manifest, sourceRelPath);
  const idx = index.plugins.findIndex((p) => p.name === entry.name);
  if (idx >= 0) {
    index.plugins[idx] = entry;
  } else {
    index.plugins.push(entry);
  }
  await writeMarketplace(index);
  return index;
}
