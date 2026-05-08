import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { buildInstallPlan, type PlannedComponent, type ResolveOptions } from './resolver.ts';
import { PLUGINS_DIR } from './paths.ts';
import { log } from './logger.ts';
import type { Preset, ExternalSetupEntry } from './schema.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PluginAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: PluginAuthor;
  homepage?: string;
  repository?: string;
  license: string;
  keywords: string[];
  mcpServers: Record<string, never>;
  skills?: string[];
  commands?: string[];
  external_setup?: ExternalSetupEntry[];
}

export interface PluginBuildResult {
  outDir: string;
  manifest: PluginManifest;
  componentCount: number;
  skipped: string[];
}

export interface BuildPluginOptions extends ResolveOptions {
  outDir?: string;
  clean?: boolean;
  author?: PluginAuthor;
  homepage?: string;
  repository?: string;
  license?: string;
}

// ── Sidecar exclusion ─────────────────────────────────────────────────────────

const FOLDER_SIDECAR_NAMES = new Set(['SOURCE.yaml']);
const FILE_SIDECAR_SUFFIX = '.source.yaml';

function isSidecar(name: string): boolean {
  return FOLDER_SIDECAR_NAMES.has(name) || name.endsWith(FILE_SIDECAR_SUFFIX);
}

// ── File copy helpers ─────────────────────────────────────────────────────────

async function copyFolderStripping(src: string, dst: string): Promise<void> {
  await mkdir(dst, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (isSidecar(entry.name)) continue;
    const srcPath = join(src, entry.name);
    const dstPath = join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyFolderStripping(srcPath, dstPath);
    } else {
      await copyFile(srcPath, dstPath);
    }
  }
}

async function copyComponent(component: PlannedComponent, pluginRoot: string): Promise<void> {
  const { type, id, layout } = component;
  const typeDir = join(pluginRoot, type);
  await mkdir(typeDir, { recursive: true });

  if (layout.kind === 'folder') {
    await copyFolderStripping(layout.componentPath, join(typeDir, id));
  } else {
    const ext = extname(layout.componentPath);
    await copyFile(layout.componentPath, join(typeDir, `${id}${ext}`));
  }
}

// ── Manifest builder ──────────────────────────────────────────────────────────

function buildManifest(
  preset: Preset,
  components: PlannedComponent[],
  opts: BuildPluginOptions,
): PluginManifest {
  const hasSkills = components.some((c) => c.type === 'skills');
  const hasCommands = components.some((c) => c.type === 'commands');

  const manifest: PluginManifest = {
    name: preset.name,
    version: preset.version,
    description: preset.description,
    author: opts.author ?? { name: 'phantien133' },
    license: opts.license ?? 'MIT',
    keywords: preset.tags,
    // Explicit empty opt-out prevents auto-loading root .mcp.json on plugin install.
    mcpServers: {},
  };

  if (opts.homepage !== undefined) manifest.homepage = opts.homepage;
  if (opts.repository !== undefined) manifest.repository = opts.repository;
  if (hasSkills) manifest.skills = ['./skills/'];
  if (hasCommands) manifest.commands = ['./commands/'];
  if (preset.external_setup.length > 0) manifest.external_setup = preset.external_setup;

  return manifest;
}

function buildSetupMd(preset: Preset): string | null {
  const entries = preset.external_setup;
  if (entries.length === 0) return null;

  const lines: string[] = [
    `# Setup — ${preset.name}`,
    '',
    'This preset requires external tools not bundled in the plugin.',
    'Complete the steps below after installing the plugin.',
    '',
    '## External Dependencies',
    '',
  ];

  for (const entry of entries) {
    const complexityBadge = entry.complexity === 'complex'
      ? ' ⚠ **[COMPLEX]**'
      : entry.complexity === 'moderate' ? ' *(moderate setup)*' : '';

    lines.push(`### ${entry.name} \`[${entry.kind}]\`${complexityBadge}`);
    lines.push('');

    if (entry.complexity === 'complex') {
      lines.push(
        '> **Warning:** This dependency requires complex setup (env vars, custom binaries, or',
        '> multi-step installation). It may not be portable to other machines without manual work.',
        '',
      );
    }

    if (entry.standalone) {
      lines.push('**Setup:** Configuration is injected automatically via `settings_patch`. No additional install needed.');
    } else if (entry.install_hint !== undefined) {
      lines.push(`**Install:**`);
      lines.push('```sh');
      lines.push(entry.install_hint);
      lines.push('```');
    } else {
      lines.push('**Setup:** Manual installation required (no install command provided — see docs).');
    }

    if (entry.docs_url !== undefined) lines.push(`\n**Docs:** ${entry.docs_url}`);
    if (entry.notes !== undefined) lines.push(`\n**Notes:** ${entry.notes}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function buildPlugin(
  presetName: string,
  opts: BuildPluginOptions = {},
): Promise<PluginBuildResult> {
  const resolveOpts: ResolveOptions = {};
  if (opts.include_optional === true) resolveOpts.include_optional = true;
  if (opts.kind !== undefined) resolveOpts.kind = opts.kind;
  const plan = await buildInstallPlan(presetName, resolveOpts);

  const pluginRoot = opts.outDir ?? join(PLUGINS_DIR, presetName);

  if (opts.clean === true) {
    await rm(pluginRoot, { recursive: true, force: true });
    log.debug(`Cleaned ${pluginRoot}`);
  }

  await mkdir(pluginRoot, { recursive: true });

  const skipped: string[] = [];
  let componentCount = 0;

  for (const component of plan.components) {
    const key = `${component.type}:${component.id}`;
    try {
      await copyComponent(component, pluginRoot);
      componentCount++;
      log.debug(`Copied ${key}`);
    } catch (err) {
      const msg = `${key}: ${err instanceof Error ? err.message : String(err)}`;
      skipped.push(msg);
      log.warn(`Skip ${msg}`);
    }
  }

  const manifest = buildManifest(plan.preset, plan.components, opts);
  const claudePluginDir = join(pluginRoot, '.claude-plugin');
  await mkdir(claudePluginDir, { recursive: true });
  await writeFile(
    join(claudePluginDir, 'plugin.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );
  log.debug(`Wrote ${join(claudePluginDir, 'plugin.json')}`);

  const setupMd = buildSetupMd(plan.preset);
  if (setupMd !== null) {
    await writeFile(join(pluginRoot, 'SETUP.md'), setupMd, 'utf8');
    log.debug(`Wrote ${join(pluginRoot, 'SETUP.md')}`);
  }

  return { outDir: pluginRoot, manifest, componentCount, skipped };
}
