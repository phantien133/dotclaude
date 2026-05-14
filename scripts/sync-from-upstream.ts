import { spawn } from 'node:child_process';
import { COMPONENT_TYPES, type ComponentType } from './lib/schema.ts';
import { locateComponent, loadSidecar } from './lib/sidecar.ts';
import { resolveSourceByRepoUrl } from './lib/upstream.ts';
import { log } from './lib/logger.ts';

interface ParsedRef {
  type: ComponentType;
  id: string;
}

function parseComponentArg(raw: string): ParsedRef {
  const idx = raw.indexOf('/');
  if (idx === -1) {
    throw new Error(
      `Invalid component arg "${raw}". Expected "<type>/<id>" e.g. "agents/code-reviewer".`,
    );
  }
  const typeRaw = raw.slice(0, idx);
  const id = raw.slice(idx + 1);
  if (!COMPONENT_TYPES.includes(typeRaw as ComponentType)) {
    throw new Error(
      `Unknown component type "${typeRaw}". Expected one of: ${COMPONENT_TYPES.join(', ')}.`,
    );
  }
  if (!id) throw new Error(`Empty component id in "${raw}".`);
  return { type: typeRaw as ComponentType, id };
}

function runCommand(
  cmd: string,
  args: readonly string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolveFn) => {
    const child = spawn(cmd, args, { cwd, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('close', (code: number | null) => {
      resolveFn({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    log.error('Usage: pnpm sync <type>/<id>   e.g. pnpm sync agents/code-reviewer');
    process.exit(2);
  }

  const ref = parseComponentArg(arg);
  log.info(`Component: ${ref.type}/${ref.id}`);

  const located = await locateComponent(ref);
  if (!located) {
    log.error(`Component not found in claudekit (public or private): ${ref.type}/${ref.id}`);
    process.exit(1);
  }
  log.info(`Source: ${located.source}`);
  log.info(`Sidecar: ${located.layout.sidecarPath}`);

  const sidecar = await loadSidecar(located.layout.sidecarPath);

  const upstream = await resolveSourceByRepoUrl(sidecar.source.repo);
  if (!upstream) {
    log.error(
      `Upstream not registered in dependencies.yaml: ${sidecar.source.repo}`,
    );
    process.exit(1);
  }
  log.info(`Upstream: ${upstream.key} → ${upstream.entry.local_path}`);
  log.info(`Pinned commit (sidecar): ${sidecar.source.commit}`);

  log.info(`Fetching upstream/${upstream.entry.name} (ref ${sidecar.source.ref})...`);
  const fetchResult = await runCommand(
    'git',
    ['fetch', '--quiet', 'origin', sidecar.source.ref],
    upstream.absolutePath,
  );
  if (fetchResult.code !== 0) {
    log.warn(
      `git fetch returned ${fetchResult.code}. stderr:\n${fetchResult.stderr.trim()}`,
    );
    log.warn('Continuing with local refs (diff may be against stale upstream).');
  }

  const headRef = `origin/${sidecar.source.ref}`;
  const headSha = await runCommand(
    'git',
    ['rev-parse', headRef],
    upstream.absolutePath,
  );
  if (headSha.code !== 0) {
    log.error(`Cannot resolve ${headRef}: ${headSha.stderr.trim()}`);
    process.exit(1);
  }
  const head = headSha.stdout.trim();
  log.info(`Upstream HEAD (${headRef}): ${head}`);

  if (head === sidecar.source.commit) {
    log.info('No changes — sidecar commit matches upstream HEAD.');
    return;
  }

  log.info('--- diff ---');
  const diff = await runCommand(
    'git',
    [
      'diff',
      `${sidecar.source.commit}..${head}`,
      '--',
      sidecar.source.path,
    ],
    upstream.absolutePath,
  );

  if (diff.code !== 0) {
    log.error(`git diff failed: ${diff.stderr.trim()}`);
    process.exit(1);
  }

  if (!diff.stdout.trim()) {
    log.info('Path unchanged between sidecar commit and upstream HEAD.');
    log.info(
      `(Other paths may have changed in upstream; only ${sidecar.source.path} inspected.)`,
    );
    return;
  }

  log.raw(diff.stdout);
  log.info('--- end diff ---');
  log.info('Phase 1: review the diff above and merge manually if desired.');
  log.info(
    `After merge, update sidecar source.commit to ${head} and bump modified flag if any local edits.`,
  );
}

main().catch((err: unknown) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
