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
 * Option A (self-contained only) is applied automatically:
 *   - hooks.json → SKIP (ECC plugin format, requires ECC runtime)
 *   - scripts/lib → SKIP
 *   - scripts/hooks/*.js → only self-contained scripts (no ../lib deps)
 *   - orchestration JS scripts → SKIP
 *   - .agents, AGENTS.md → SKIP (ECC-specific)
 */

import { copyFile, cp, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative } from 'node:path';
import { Command } from 'commander';
import { dumpYaml } from './lib/yaml.ts';
import { CLAUDEKIT_DIR, REPO_ROOT, UPSTREAM_DIR } from './lib/paths.ts';
import { loadUpstreamSources } from './lib/upstream.ts';

// ── Constants ─────────────────────────────────────────────────────────────────

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

// Option A: only these hook scripts are self-contained (no ../lib/ imports)
const SELF_CONTAINED_HOOKS = new Set([
  'auto-tmux-dev.js',
  'block-no-verify.js',
  'config-protection.js',
  'design-quality-check.js',
  'doc-file-warning.js',
  'gateguard-fact-force.js',
  'governance-capture.js',
  'insaits-security-wrapper.js',
  'mcp-health-check.js',
  'observe-runner.js',
  'plugin-hook-bootstrap.js',
  'post-bash-build-complete.js',
  'post-bash-command-log.js',
  'post-bash-dispatcher.js',
  'post-bash-pr-created.js',
  'post-edit-accumulator.js',
  'post-edit-typecheck.js',
  'pre-bash-commit-quality.js',
  'pre-bash-dispatcher.js',
  'pre-bash-git-push-reminder.js',
  'pre-bash-tmux-reminder.js',
  'pre-write-doc-warn.js',
  'session-start-bootstrap.js',
  'insaits-security-monitor.py',
]);

// Paths that cannot be vendored standalone (Option A decision)
const SKIP_PATHS = new Set([
  'hooks',                              // hooks.json requires ECC plugin runtime
  'scripts/lib',                        // ECC internal lib
  '.agents',                            // ECC-specific project manifest
  'AGENTS.md',                          // ECC guidance doc
  'the-security-guide.md',              // Large standalone doc, skip for now
  // orchestration JS runtime scripts
  'scripts/lib/orchestration-session.js',
  'scripts/lib/tmux-worktree-orchestrator.js',
  'scripts/orchestrate-codex-worker.sh',
  'scripts/orchestrate-worktrees.js',
  'scripts/orchestration-status.js',
]);

// ── Types ─────────────────────────────────────────────────────────────────────

interface ComponentSpec {
  upstreamPath: string;    // relative to ECC root (used in sidecar source.path)
  upstreamAbs: string;     // absolute path in upstream/
  type: 'agents' | 'skills' | 'commands' | 'hooks' | 'rules';
  id: string;              // e.g. 'python-patterns', 'common/coding-style'
  layout: 'file' | 'folder';
  destAbs: string;         // absolute destination in claudekit/
  sidecarAbs: string;      // absolute path for sidecar YAML
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

async function expandAgents(): Promise<ComponentSpec[]> {
  const agentsDir = join(ECC_UPSTREAM, 'agents');
  const files = await walkDir(agentsDir, (n) => n.endsWith('.md'));
  return files.map((abs) => {
    const name = basename(abs, '.md');
    const upstreamPath = `agents/${name}.md`;
    const destAbs = join(CLAUDEKIT_DIR, 'agents', `${name}.md`);
    const sidecarAbs = join(CLAUDEKIT_DIR, 'agents', `${name}.source.yaml`);
    return { upstreamPath, upstreamAbs: abs, type: 'agents', id: name, layout: 'file', destAbs, sidecarAbs };
  });
}

async function expandCommands(subPath?: string): Promise<ComponentSpec[]> {
  const commandsDir = subPath
    ? join(ECC_UPSTREAM, dirname(subPath))
    : join(ECC_UPSTREAM, 'commands');
  const files = subPath
    ? [join(ECC_UPSTREAM, subPath)]
    : await walkDir(commandsDir, (n) => n.endsWith('.md'));
  return files.map((abs) => {
    const name = basename(abs, '.md');
    const upstreamPath = `commands/${name}.md`;
    const destAbs = join(CLAUDEKIT_DIR, 'commands', `${name}.md`);
    const sidecarAbs = join(CLAUDEKIT_DIR, 'commands', `${name}.source.yaml`);
    return { upstreamPath, upstreamAbs: abs, type: 'commands', id: name, layout: 'file', destAbs, sidecarAbs };
  });
}

async function expandRules(): Promise<ComponentSpec[]> {
  const rulesDir = join(ECC_UPSTREAM, 'rules');
  const files = await walkDir(rulesDir, (n) => n.endsWith('.md'), true);
  return files.map((abs) => {
    const rel = relative(rulesDir, abs); // e.g. 'common/coding-style.md'
    const id = rel.replace(/\.md$/, ''); // e.g. 'common/coding-style'
    const upstreamPath = `rules/${rel}`;
    const destAbs = join(CLAUDEKIT_DIR, 'rules', rel);
    const sidecarAbs = join(CLAUDEKIT_DIR, 'rules', rel.replace(/\.md$/, '.source.yaml'));
    return { upstreamPath, upstreamAbs: abs, type: 'rules', id, layout: 'file', destAbs, sidecarAbs };
  });
}

async function expandHooks(): Promise<ComponentSpec[]> {
  const hooksDir = join(ECC_UPSTREAM, 'scripts', 'hooks');
  const files = await walkDir(hooksDir, (n) => SELF_CONTAINED_HOOKS.has(n));
  return files.map((abs) => {
    const filename = basename(abs);
    const ext = extname(filename);
    const name = basename(filename, ext);
    const upstreamPath = `scripts/hooks/${filename}`;
    const destAbs = join(CLAUDEKIT_DIR, 'hooks', filename);
    const sidecarAbs = join(CLAUDEKIT_DIR, 'hooks', `${name}.source.yaml`);
    return { upstreamPath, upstreamAbs: abs, type: 'hooks', id: name, layout: 'file', destAbs, sidecarAbs };
  });
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

  // skills/<name> → folder component
  if (rawPath.startsWith('skills/') && isDir) {
    const id = rawPath.slice('skills/'.length);
    const destAbs = join(CLAUDEKIT_DIR, 'skills', id);
    const sidecarAbs = join(destAbs, 'SOURCE.yaml');
    return { upstreamPath: rawPath, upstreamAbs, type: 'skills', id, layout: 'folder', destAbs, sidecarAbs };
  }

  // agents/<name>.md
  if (rawPath.startsWith('agents/') && rawPath.endsWith('.md')) {
    const id = basename(rawPath, '.md');
    const destAbs = join(CLAUDEKIT_DIR, 'agents', `${id}.md`);
    const sidecarAbs = join(CLAUDEKIT_DIR, 'agents', `${id}.source.yaml`);
    return { upstreamPath: rawPath, upstreamAbs, type: 'agents', id, layout: 'file', destAbs, sidecarAbs };
  }

  // commands/<name>.md
  if (rawPath.startsWith('commands/') && rawPath.endsWith('.md')) {
    const id = basename(rawPath, '.md');
    const destAbs = join(CLAUDEKIT_DIR, 'commands', `${id}.md`);
    const sidecarAbs = join(CLAUDEKIT_DIR, 'commands', `${id}.source.yaml`);
    return { upstreamPath: rawPath, upstreamAbs, type: 'commands', id, layout: 'file', destAbs, sidecarAbs };
  }

  // rules/<...>.md
  if (rawPath.startsWith('rules/') && rawPath.endsWith('.md')) {
    const rel = rawPath.slice('rules/'.length); // e.g. 'common/coding-style.md'
    const id = rel.replace(/\.md$/, '');
    const destAbs = join(CLAUDEKIT_DIR, 'rules', rel);
    const sidecarAbs = join(CLAUDEKIT_DIR, 'rules', rel.replace(/\.md$/, '.source.yaml'));
    return { upstreamPath: rawPath, upstreamAbs, type: 'rules', id, layout: 'file', destAbs, sidecarAbs };
  }

  // scripts/hooks/<name>.{js,py}
  if (rawPath.startsWith('scripts/hooks/')) {
    const filename = basename(rawPath);
    if (!SELF_CONTAINED_HOOKS.has(filename)) {
      console.warn(`  SKIP (needs ECC lib): ${rawPath}`);
      return null;
    }
    const ext = extname(filename);
    const id = basename(filename, ext);
    const destAbs = join(CLAUDEKIT_DIR, 'hooks', filename);
    const sidecarAbs = join(CLAUDEKIT_DIR, 'hooks', `${id}.source.yaml`);
    return { upstreamPath: rawPath, upstreamAbs, type: 'hooks', id, layout: 'file', destAbs, sidecarAbs };
  }

  console.warn(`  SKIP (unrecognized path pattern): ${rawPath}`);
  return null;
}

async function expandModulePaths(paths: string[]): Promise<ComponentSpec[]> {
  const specs: ComponentSpec[] = [];
  for (const rawPath of paths) {
    if (SKIP_PATHS.has(rawPath)) continue;
    // Aggregate directory paths
    if (rawPath === 'agents') { specs.push(...(await expandAgents())); continue; }
    if (rawPath === 'commands') { specs.push(...(await expandCommands())); continue; }
    if (rawPath === 'rules') { specs.push(...(await expandRules())); continue; }
    if (rawPath === 'scripts/hooks') { specs.push(...(await expandHooks())); continue; }
    // Single path
    const spec = await buildSpec(rawPath);
    if (spec) specs.push(spec);
  }
  return specs;
}

// ── Sidecar generation ────────────────────────────────────────────────────────

function schemaComment(sidecarAbs: string): string {
  const schemaAbs = join(REPO_ROOT, 'presets', 'schema', 'sidecar.schema.json');
  const rel = relative(dirname(sidecarAbs), schemaAbs);
  return `# yaml-language-server: $schema=${rel}`;
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
    modified: false,
    modifications: null,
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

// ── Copy logic ────────────────────────────────────────────────────────────────

async function pathExists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

async function vendorOne(
  spec: ComponentSpec,
  eccCommit: string,
  opts: VendorOptions,
): Promise<VendorResult> {
  const exists = await pathExists(spec.destAbs);
  if (exists && !opts.force) {
    return { spec, status: 'skipped-exists' };
  }
  if (opts.dryRun) {
    return { spec, status: 'dry-run' };
  }

  await mkdir(dirname(spec.destAbs), { recursive: true });

  if (spec.layout === 'folder') {
    // Copy folder, excluding any existing SOURCE.yaml (our own addition)
    await cp(spec.upstreamAbs, spec.destAbs, {
      recursive: true,
      filter: (src) => basename(src) !== 'SOURCE.yaml',
    });
  } else {
    await copyFile(spec.upstreamAbs, spec.destAbs);
  }

  // Write sidecar (always fresh — no schema comment needed for existing ones)
  await mkdir(dirname(spec.sidecarAbs), { recursive: true });
  await writeFile(spec.sidecarAbs, buildSidecarContent(spec, eccCommit), 'utf8');

  return { spec, status: 'vendored' };
}

// ── Module loading ────────────────────────────────────────────────────────────

async function loadModulePaths(moduleId: string): Promise<Map<string, string[]>> {
  const raw = await import(MODULES_JSON, { with: { type: 'json' } });
  const modules: Array<{ id: string; paths: string[] }> = (raw as { default: { modules: Array<{ id: string; paths: string[] }> } }).default.modules;
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
  .description('Bulk-vendor ECC components into claudekit/')
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
if (!eccSource) {
  console.error('Error: "ecc" entry not found in dependencies.yaml');
  process.exit(1);
}
const eccCommit = eccSource.pinned_commit ?? '';
if (!eccCommit) {
  console.error('Error: ecc.pinned_commit is not set in dependencies.yaml');
  process.exit(1);
}

const vendorOpts: VendorOptions = { dryRun: opts.dryRun, force: opts.force };

// Build component list
let specs: ComponentSpec[] = [];

if (opts.module) {
  const moduleMap = await loadModulePaths(opts.module);
  if (moduleMap.size === 0) {
    console.error(`Error: module "${opts.module}" not found (or all modules excluded)`);
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

// Run
let vendored = 0;
let skipped = 0;
let dryCount = 0;

for (const spec of specs) {
  const result = await vendorOne(spec, eccCommit, vendorOpts);
  const icon = result.status === 'vendored' ? '✓' : result.status === 'dry-run' ? '~' : '·';
  console.log(`  ${icon} ${result.status.padEnd(14)} ${spec.type}/${spec.id}`);
  if (result.status === 'vendored') vendored++;
  else if (result.status === 'skipped-exists') skipped++;
  else dryCount++;
}

console.log(`\nDone.`);
if (opts.dryRun) {
  console.log(`  Would vendor: ${dryCount}`);
} else {
  console.log(`  Vendored:  ${vendored}`);
  console.log(`  Skipped:   ${skipped}  (already exist — use --force to overwrite)`);
}
