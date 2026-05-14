/**
 * Bulk-vendor ECC components into claudekit/
 *
 * Usage:
 *   pnpm vendor-batch --module <id>       # all paths in one module
 *   pnpm vendor-batch --module all        # all non-excluded modules
 *   pnpm vendor-batch --path <p>          # one specific upstream path
 *   pnpm vendor-batch --module <id> --dry-run
 *   pnpm vendor-batch --module <id> --force
 *
 * Option B (bundle lib) — ALL hook scripts are vendored, not just self-contained ones.
 * ECC lib files are bundled to claudekit/hooks/lib/ and imports in hook scripts are
 * rewritten from require('../lib/X') → require('./lib/X').
 *
 * Still skipped (cannot be made standalone):
 *   - hooks/hooks.json  — ECC plugin format; needs separate preset/settings_patch work
 *   - scripts/lib/      — vendored selectively as hooks/lib/ bundle, not as-is
 *   - orchestration JS runtime scripts
 *   - .agents, AGENTS.md  — ECC-specific
 */

import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative } from 'node:path';
import { Command } from 'commander';
import { dumpYaml } from './lib/yaml.ts';
import { REPO_ROOT, UPSTREAM_DIR, claudekitSourceDir } from './lib/paths.ts';
import { loadUpstreamSources } from './lib/upstream.ts';

// ── Constants ─────────────────────────────────────────────────────────────────

// vendor-batch writes ECC components into claudekit/everything-claude-code/.
const ECC_DEST_ROOT = claudekitSourceDir('everything-claude-code');
const ECC_UPSTREAM = join(UPSTREAM_DIR, 'everything-claude-code');
const ECC_REPO = 'https://github.com/affaan-m/everything-claude-code';
const ECC_REF = 'main';
const MODULES_JSON = join(ECC_UPSTREAM, 'manifests', 'install-modules.json');
const TODAY = new Date().toISOString().slice(0, 10);

const EXCLUDED_MODULES = new Set([
  'business-content',
  'swift-apple',
  'supply-chain-domain',
  'platform-configs',
]);

// Option B: lib files to bundle alongside hook scripts into claudekit/hooks/lib/
// All are stdlib-only (no npm deps) and their internal cross-refs are ./X (no rewriting needed).
const LIB_BUNDLE = new Set([
  'utils.js',           // used by 9 hooks + observer-sessions, package-manager, session-aliases
  'hook-flags.js',      // used by bash-hook-dispatcher, check-hook-enabled, run-with-flags
  'resolve-formatter.js', // used by post-edit-format, quality-gate, stop-format-typecheck
  'shell-split.js',     // used by pre-bash-dev-server-block
  'observer-sessions.js', // used by session-end-marker, session-start; imports ./utils
  'package-manager.js', // used by session-start; imports ./utils
  'project-detect.js',  // used by session-start
  'session-aliases.js', // used by session-start; imports ./utils
]);

// Paths that cannot be made standalone — skip entirely
const SKIP_PATHS = new Set([
  'hooks',                              // hooks.json is ECC plugin format (requires ~/.claude/plugins/ecc/)
  'scripts/lib',                        // ECC internal lib — vendored selectively as hooks/lib/ bundle
  '.agents',                            // ECC-specific project manifest (not Claude Code native)
  'AGENTS.md',                          // ECC guidance doc
  'the-security-guide.md',              // Large standalone doc
  // orchestration JS runtime (all depend on scripts/lib/ plumbing)
  'scripts/lib/orchestration-session.js',
  'scripts/lib/tmux-worktree-orchestrator.js',
  'scripts/orchestrate-codex-worker.sh',
  'scripts/orchestrate-worktrees.js',
  'scripts/orchestration-status.js',
]);

// ── Types ─────────────────────────────────────────────────────────────────────

interface ComponentSpec {
  upstreamPath: string;    // relative to ECC root (used in sidecar source.path)
  upstreamAbs: string;
  type: 'agents' | 'skills' | 'commands' | 'hooks' | 'rules';
  id: string;              // e.g. 'python-patterns', 'common/coding-style', 'lib/utils'
  layout: 'file' | 'folder';
  destAbs: string;
  sidecarAbs: string;
  rewriteImports: boolean; // true for hooks that use require('../lib/')
}

interface VendorOptions {
  dryRun: boolean;
  force: boolean;
}

interface VendorResult {
  spec: ComponentSpec;
  status: 'vendored' | 'skipped-exists' | 'dry-run';
}

// ── Path expansion ────────────────────────────────────────────────────────────

async function walkDir(
  dir: string,
  filter: (name: string) => boolean,
  recursive = false,
): Promise<string[]> {
  const results: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const e of entries) {
    const abs = join(dir, e.name);
    if (e.isDirectory() && recursive) {
      results.push(...(await walkDir(abs, filter, true)));
    } else if (e.isFile() && filter(e.name)) {
      results.push(abs);
    }
  }
  return results;
}

async function hasLibImport(filePath: string): Promise<boolean> {
  try {
    const content = await readFile(filePath, 'utf8');
    return content.includes("require('../lib/");
  } catch {
    return false;
  }
}

async function expandAgents(): Promise<ComponentSpec[]> {
  const agentsDir = join(ECC_UPSTREAM, 'agents');
  const files = await walkDir(agentsDir, (n) => n.endsWith('.md'));
  return files.map((abs) => {
    const name = basename(abs, '.md');
    return {
      upstreamPath: `agents/${name}.md`,
      upstreamAbs: abs,
      type: 'agents',
      id: name,
      layout: 'file',
      destAbs: join(ECC_DEST_ROOT, 'agents', `${name}.md`),
      sidecarAbs: join(ECC_DEST_ROOT, 'agents', `${name}.source.yaml`),
      rewriteImports: false,
    };
  });
}

async function expandCommands(): Promise<ComponentSpec[]> {
  const commandsDir = join(ECC_UPSTREAM, 'commands');
  const files = await walkDir(commandsDir, (n) => n.endsWith('.md'));
  return files.map((abs) => {
    const name = basename(abs, '.md');
    return {
      upstreamPath: `commands/${name}.md`,
      upstreamAbs: abs,
      type: 'commands',
      id: name,
      layout: 'file',
      destAbs: join(ECC_DEST_ROOT, 'commands', `${name}.md`),
      sidecarAbs: join(ECC_DEST_ROOT, 'commands', `${name}.source.yaml`),
      rewriteImports: false,
    };
  });
}

async function expandRules(): Promise<ComponentSpec[]> {
  const rulesDir = join(ECC_UPSTREAM, 'rules');
  const files = await walkDir(rulesDir, (n) => n.endsWith('.md'), true);
  return files.map((abs) => {
    const rel = relative(rulesDir, abs);
    const id = rel.replace(/\.md$/, '');
    return {
      upstreamPath: `rules/${rel}`,
      upstreamAbs: abs,
      type: 'rules',
      id,
      layout: 'file',
      destAbs: join(ECC_DEST_ROOT, 'rules', rel),
      sidecarAbs: join(ECC_DEST_ROOT, 'rules', rel.replace(/\.md$/, '.source.yaml')),
      rewriteImports: false,
    };
  });
}

async function expandHooks(): Promise<ComponentSpec[]> {
  const hooksDir = join(ECC_UPSTREAM, 'scripts', 'hooks');
  const libDir = join(ECC_UPSTREAM, 'scripts', 'lib');

  // ALL hook scripts (Option B — not filtered to self-contained only)
  const hookFiles = await walkDir(hooksDir, (n) => n.endsWith('.js') || n.endsWith('.py'));
  const hookSpecs: ComponentSpec[] = await Promise.all(
    hookFiles.map(async (abs) => {
      const filename = basename(abs);
      const ext = extname(filename);
      const id = basename(filename, ext);
      return {
        upstreamPath: `scripts/hooks/${filename}`,
        upstreamAbs: abs,
        type: 'hooks' as const,
        id,
        layout: 'file' as const,
        destAbs: join(ECC_DEST_ROOT, 'hooks', filename),
        sidecarAbs: join(ECC_DEST_ROOT, 'hooks', `${id}.source.yaml`),
        rewriteImports: await hasLibImport(abs),
      };
    }),
  );

  // Lib bundle: 8 selected lib files → claudekit/hooks/lib/
  const libSpecs: ComponentSpec[] = [];
  for (const libFile of LIB_BUNDLE) {
    const abs = join(libDir, libFile);
    try {
      await stat(abs);
    } catch {
      console.warn(`  WARN: lib file not found: ${libFile}`);
      continue;
    }
    const id = `lib/${basename(libFile, '.js')}`;
    libSpecs.push({
      upstreamPath: `scripts/lib/${libFile}`,
      upstreamAbs: abs,
      type: 'hooks',
      id,
      layout: 'file',
      destAbs: join(ECC_DEST_ROOT, 'hooks', 'lib', libFile),
      sidecarAbs: join(ECC_DEST_ROOT, 'hooks', 'lib', `${basename(libFile, '.js')}.source.yaml`),
      rewriteImports: false, // lib files use ./X (already correct)
    });
  }

  return [...hookSpecs, ...libSpecs];
}

async function buildSpec(rawPath: string): Promise<ComponentSpec | null> {
  if (SKIP_PATHS.has(rawPath)) return null;

  const upstreamAbs = join(ECC_UPSTREAM, rawPath);
  let s;
  try {
    s = await stat(upstreamAbs);
  } catch {
    console.warn(`  WARN: upstream path not found: ${rawPath}`);
    return null;
  }

  const isDir = s.isDirectory();

  if (rawPath.startsWith('skills/') && isDir) {
    const id = rawPath.slice('skills/'.length);
    const destAbs = join(ECC_DEST_ROOT, 'skills', id);
    return {
      upstreamPath: rawPath,
      upstreamAbs,
      type: 'skills',
      id,
      layout: 'folder',
      destAbs,
      sidecarAbs: join(destAbs, 'SOURCE.yaml'),
      rewriteImports: false,
    };
  }

  if (rawPath.startsWith('agents/') && rawPath.endsWith('.md')) {
    const id = basename(rawPath, '.md');
    return {
      upstreamPath: rawPath,
      upstreamAbs,
      type: 'agents',
      id,
      layout: 'file',
      destAbs: join(ECC_DEST_ROOT, 'agents', `${id}.md`),
      sidecarAbs: join(ECC_DEST_ROOT, 'agents', `${id}.source.yaml`),
      rewriteImports: false,
    };
  }

  if (rawPath.startsWith('commands/') && rawPath.endsWith('.md')) {
    const id = basename(rawPath, '.md');
    return {
      upstreamPath: rawPath,
      upstreamAbs,
      type: 'commands',
      id,
      layout: 'file',
      destAbs: join(ECC_DEST_ROOT, 'commands', `${id}.md`),
      sidecarAbs: join(ECC_DEST_ROOT, 'commands', `${id}.source.yaml`),
      rewriteImports: false,
    };
  }

  if (rawPath.startsWith('rules/') && rawPath.endsWith('.md')) {
    const rel = rawPath.slice('rules/'.length);
    const id = rel.replace(/\.md$/, '');
    return {
      upstreamPath: rawPath,
      upstreamAbs,
      type: 'rules',
      id,
      layout: 'file',
      destAbs: join(ECC_DEST_ROOT, 'rules', rel),
      sidecarAbs: join(ECC_DEST_ROOT, 'rules', rel.replace(/\.md$/, '.source.yaml')),
      rewriteImports: false,
    };
  }

  if (rawPath.startsWith('scripts/hooks/')) {
    const filename = basename(rawPath);
    const ext = extname(filename);
    const id = basename(filename, ext);
    const abs = upstreamAbs;
    return {
      upstreamPath: rawPath,
      upstreamAbs: abs,
      type: 'hooks',
      id,
      layout: 'file',
      destAbs: join(ECC_DEST_ROOT, 'hooks', filename),
      sidecarAbs: join(ECC_DEST_ROOT, 'hooks', `${id}.source.yaml`),
      rewriteImports: await hasLibImport(abs),
    };
  }

  console.warn(`  SKIP (unrecognized path pattern): ${rawPath}`);
  return null;
}

async function expandModulePaths(paths: string[]): Promise<ComponentSpec[]> {
  const specs: ComponentSpec[] = [];
  for (const rawPath of paths) {
    if (SKIP_PATHS.has(rawPath)) continue;
    if (rawPath === 'agents') { specs.push(...(await expandAgents())); continue; }
    if (rawPath === 'commands') { specs.push(...(await expandCommands())); continue; }
    if (rawPath === 'rules') { specs.push(...(await expandRules())); continue; }
    if (rawPath === 'scripts/hooks') { specs.push(...(await expandHooks())); continue; }
    const spec = await buildSpec(rawPath);
    if (spec) specs.push(spec);
  }
  return specs;
}

// ── Sidecar generation ────────────────────────────────────────────────────────

function schemaComment(sidecarAbs: string): string {
  const schemaAbs = join(REPO_ROOT, 'presets', 'schema', 'sidecar.schema.json');
  return `# yaml-language-server: $schema=${relative(dirname(sidecarAbs), schemaAbs)}`;
}

function buildSidecarContent(spec: ComponentSpec, eccCommit: string): string {
  const data = {
    source: {
      repo: ECC_REPO,
      commit: eccCommit,
      path: spec.upstreamPath,
      ref: ECC_REF,
    },
    imported_at: TODAY,
    license: 'MIT',
    modified: spec.rewriteImports, // import rewrite counts as a modification
    modifications: spec.rewriteImports
      ? 'require("../lib/") → require("./lib/") — path adjusted for claudekit/hooks/ layout'
      : null,
    notes: null,
    dependencies: {
      required: { agents: [], skills: [], commands: [], hooks: [], rules: [] },
      optional: { agents: [], skills: [], commands: [], hooks: [], rules: [] },
      external: [],
    },
    tags: [],
    categories: {},
  };
  return `${schemaComment(spec.sidecarAbs)}\n${dumpYaml(data)}`;
}

// ── Copy / write logic ────────────────────────────────────────────────────────

async function pathExists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

async function vendorOne(
  spec: ComponentSpec,
  eccCommit: string,
  opts: VendorOptions,
): Promise<VendorResult> {
  const exists = await pathExists(spec.destAbs);
  if (exists && !opts.force) return { spec, status: 'skipped-exists' };
  if (opts.dryRun) return { spec, status: 'dry-run' };

  await mkdir(dirname(spec.destAbs), { recursive: true });

  if (spec.layout === 'folder') {
    // Skills: copy folder excluding any pre-existing SOURCE.yaml
    const { cp } = await import('node:fs/promises');
    await cp(spec.upstreamAbs, spec.destAbs, {
      recursive: true,
      filter: (src: string) => basename(src) !== 'SOURCE.yaml',
    });
  } else if (spec.rewriteImports) {
    // Hook scripts needing lib: rewrite require('../lib/X') → require('./lib/X')
    let content = await readFile(spec.upstreamAbs, 'utf8');
    content = content.replaceAll("require('../lib/", "require('./lib/");
    await writeFile(spec.destAbs, content, 'utf8');
  } else {
    await copyFile(spec.upstreamAbs, spec.destAbs);
  }

  await mkdir(dirname(spec.sidecarAbs), { recursive: true });
  await writeFile(spec.sidecarAbs, buildSidecarContent(spec, eccCommit), 'utf8');

  return { spec, status: 'vendored' };
}

// ── Module loading ────────────────────────────────────────────────────────────

async function loadModulePaths(moduleId: string): Promise<Map<string, string[]>> {
  const raw = await import(MODULES_JSON, { with: { type: 'json' } });
  const modules: Array<{ id: string; paths: string[] }> =
    (raw as { default: { modules: Array<{ id: string; paths: string[] }> } }).default.modules;
  const result = new Map<string, string[]>();
  for (const mod of modules) {
    if (moduleId === 'all') {
      if (!EXCLUDED_MODULES.has(mod.id)) result.set(mod.id, mod.paths);
    } else if (mod.id === moduleId) {
      result.set(mod.id, mod.paths);
    }
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const program = new Command();
program
  .name('vendor-batch')
  .description('Bulk-vendor ECC components into claudekit/ (Option B: bundle lib)')
  .option('--module <id>', 'Module ID from install-modules.json, or "all"')
  .option('--path <path>', 'Single upstream path (e.g. skills/python-patterns)')
  .option('--dry-run', 'Print what would be vendored without writing files', false)
  .option('--force', 'Overwrite already-vendored components', false)
  .parse();

const opts = program.opts<{ module?: string; path?: string; dryRun: boolean; force: boolean }>();

if (!opts.module && !opts.path) {
  console.error('Error: provide --module <id> or --path <p>');
  process.exit(1);
}

const sources = await loadUpstreamSources();
const eccSource = sources['ecc'];
if (!eccSource?.pinned_commit) {
  console.error('Error: ecc.pinned_commit not set in dependencies.yaml');
  process.exit(1);
}
const eccCommit = eccSource.pinned_commit;
const vendorOpts: VendorOptions = { dryRun: opts.dryRun, force: opts.force };

// Build component list
let specs: ComponentSpec[] = [];

if (opts.module) {
  const moduleMap = await loadModulePaths(opts.module);
  if (moduleMap.size === 0) {
    console.error(`Error: module "${opts.module}" not found (or excluded)`);
    process.exit(1);
  }
  for (const [modId, paths] of moduleMap) {
    console.log(`\nModule: ${modId} (${paths.length} paths)`);
    const modSpecs = await expandModulePaths(paths);
    console.log(`  → ${modSpecs.length} components after expansion`);
    specs.push(...modSpecs);
  }
}

if (opts.path) {
  const spec = await buildSpec(opts.path);
  if (spec) specs.push(spec);
}

if (specs.length === 0) {
  console.log('Nothing to vendor.');
  process.exit(0);
}

console.log(`\n${opts.dryRun ? '[DRY RUN] ' : ''}Vendoring ${specs.length} components...`);

let vendored = 0, skipped = 0, dryCount = 0;

for (const spec of specs) {
  const result = await vendorOne(spec, eccCommit, vendorOpts);
  const icon = result.status === 'vendored' ? '✓' : result.status === 'dry-run' ? '~' : '·';
  const rewriteTag = spec.rewriteImports ? ' [import-rewrite]' : '';
  console.log(`  ${icon} ${result.status.padEnd(14)} ${spec.type}/${spec.id}${rewriteTag}`);
  if (result.status === 'vendored') vendored++;
  else if (result.status === 'skipped-exists') skipped++;
  else dryCount++;
}

console.log('\nDone.');
if (opts.dryRun) {
  const rewrites = specs.filter((s) => s.rewriteImports).length;
  console.log(`  Would vendor:        ${dryCount}`);
  console.log(`  Import rewrites:     ${rewrites}`);
} else {
  console.log(`  Vendored:  ${vendored}`);
  console.log(`  Skipped:   ${skipped}  (use --force to overwrite)`);
}
