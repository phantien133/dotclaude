import type { Preset, HookManifestEntry, HookEvent } from './schema.ts';
import { HOOK_EVENTS } from './schema.ts';

const HOOK_DESCRIPTIONS: Record<string, string> = {
  'post-edit-typecheck.js': 'TypeScript check after editing .ts/.tsx files',
  'pre-bash-commit-quality.js': 'Quality gate before git commit',
  'block-no-verify.js': 'Block --no-verify flag to prevent bypassing hooks',
  'suggest-compact.js': 'Suggest /compact to preserve context',
  'pre-compact.js': 'Save session state before compaction',
  'desktop-notify.js': 'Desktop notification when Claude stops',
  'cost-tracker.js': 'Append token usage to ~/.claude/metrics/costs.jsonl',
  'doc-file-warning.js': 'Warn before creating ad-hoc doc files (NOTES, TODO, SCRATCH, etc.)',
};

const HOOK_EVENTS_SET: ReadonlySet<string> = new Set(HOOK_EVENTS);

function isHookEvent(value: string): value is HookEvent {
  return HOOK_EVENTS_SET.has(value);
}

function describeFile(file: string): string {
  return (
    HOOK_DESCRIPTIONS[file] ??
    file
      .replace(/\.[^.]+$/, '')
      .replace(/-/g, ' ')
  );
}

/**
 * Build HookManifestEntry[] from an ordered list of presets (parent → child).
 * Each hook is attributed to the first preset in the chain that declares it.
 * Deduplicates by file name so inherited hooks are not double-listed.
 */
export function buildHooksManifestEntries(allPresets: Preset[]): HookManifestEntry[] {
  const entries: HookManifestEntry[] = [];
  const seenFiles = new Set<string>();

  for (const preset of allPresets) {
    const hooksBlock = preset.settings_patch['hooks'] as Record<string, unknown> | undefined;
    if (hooksBlock === undefined || hooksBlock === null) continue;

    for (const [event, matchers] of Object.entries(hooksBlock)) {
      if (!isHookEvent(event)) continue;
      if (!Array.isArray(matchers)) continue;

      for (const matcherEntry of matchers) {
        const matcher =
          (matcherEntry as { matcher?: string }).matcher ?? '';
        const hookCmds = (matcherEntry as { hooks?: unknown[] }).hooks;
        if (!Array.isArray(hookCmds)) continue;

        for (const hookCmd of hookCmds) {
          const command = (hookCmd as { command?: string }).command ?? '';
          const match = /\/hooks\/([^/\s]+)$/.exec(command);
          const file = match?.[1];
          if (file === undefined || file === '') continue;
          if (seenFiles.has(file)) continue;
          seenFiles.add(file);

          entries.push({
            file,
            description: describeFile(file),
            event,
            matcher,
            preset: preset.name,
          });
        }
      }
    }
  }

  return entries;
}
