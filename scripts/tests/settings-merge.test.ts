import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  mergeSettings,
  loadSettings,
  writeSettings,
  subtractSettings,
  rewriteHookPaths,
} from '../lib/settings-merge.ts';

vi.mock('node:fs/promises');
import * as fsPromises from 'node:fs/promises';

vi.mock('../lib/fs-ops.ts', () => ({
  backup: vi.fn().mockResolvedValue(null),
}));

// ── mergeSettings ─────────────────────────────────────────────────────────────

describe('mergeSettings', () => {
  it('empty patch returns clone of existing', () => {
    const existing = { a: 1, b: 'x' };
    const result = mergeSettings(existing, {});
    expect(result).toEqual({ a: 1, b: 'x' });
    expect(result).not.toBe(existing);
  });

  it('top-level key from patch overwrites scalar', () => {
    const result = mergeSettings({ key: 'old' }, { key: 'new' });
    expect(result['key']).toBe('new');
  });

  it('new key from patch is added', () => {
    const result = mergeSettings({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('nested objects are recursively merged', () => {
    const result = mergeSettings({ foo: { x: 1, y: 2 } }, { foo: { y: 99, z: 3 } });
    expect(result['foo']).toEqual({ x: 1, y: 99, z: 3 });
  });

  it('arrays are concatenated, not replaced', () => {
    const result = mergeSettings(
      { hooks: ['PostToolUse-a'] },
      { hooks: ['PostToolUse-b'] },
    );
    expect(result['hooks']).toEqual(['PostToolUse-a', 'PostToolUse-b']);
  });

  it('empty existing with populated patch returns patch', () => {
    const result = mergeSettings({}, { x: 42, arr: [1, 2] });
    expect(result).toEqual({ x: 42, arr: [1, 2] });
  });

  it('does not mutate existing', () => {
    const existing: Record<string, unknown> = { a: 1 };
    mergeSettings(existing, { a: 2 });
    expect(existing['a']).toBe(1);
  });
});

// ── subtractSettings ──────────────────────────────────────────────────────────

describe('subtractSettings', () => {
  it('removes scalar when current equals patch', () => {
    const result = subtractSettings({ a: 1, b: 2 }, { a: 1 });
    expect(result).toEqual({ b: 2 });
  });

  it('keeps scalar when current differs from patch (preserves user edits)', () => {
    const result = subtractSettings({ a: 99 }, { a: 1 });
    expect(result).toEqual({ a: 99 });
  });

  it('removes array items by structural equality', () => {
    const result = subtractSettings(
      { hooks: ['a', 'b', 'c'] },
      { hooks: ['b'] },
    );
    expect(result).toEqual({ hooks: ['a', 'c'] });
  });

  it('drops array key entirely when all items removed', () => {
    const result = subtractSettings(
      { hooks: ['a', 'b'] },
      { hooks: ['a', 'b'] },
    );
    expect(result).toEqual({});
  });

  it('removes deeply nested object entries', () => {
    const result = subtractSettings(
      { outer: { inner: { x: 1, y: 2 } } },
      { outer: { inner: { x: 1 } } },
    );
    expect(result).toEqual({ outer: { inner: { y: 2 } } });
  });

  it('drops a nested key path that becomes empty', () => {
    const result = subtractSettings(
      { outer: { inner: { x: 1 } } },
      { outer: { inner: { x: 1 } } },
    );
    expect(result).toEqual({});
  });

  it('ignores keys not present in current', () => {
    const result = subtractSettings({ a: 1 }, { b: 2, c: 3 });
    expect(result).toEqual({ a: 1 });
  });

  it('removes complex hook entry by deep equality', () => {
    const hookEntry = {
      matcher: 'Bash',
      hooks: [{ type: 'command', command: 'node old/path.js' }],
    };
    const otherEntry = {
      matcher: 'Edit',
      hooks: [{ type: 'command', command: 'node keep.js' }],
    };
    const result = subtractSettings(
      { hooks: { PreToolUse: [hookEntry, otherEntry] } },
      { hooks: { PreToolUse: [hookEntry] } },
    );
    expect(result).toEqual({ hooks: { PreToolUse: [otherEntry] } });
  });

  it('does not mutate existing', () => {
    const existing: Record<string, unknown> = { a: 1, arr: [1, 2] };
    subtractSettings(existing, { a: 1, arr: [1] });
    expect(existing).toEqual({ a: 1, arr: [1, 2] });
  });

  it('subtract → merge round-trip with changed array values does not accumulate duplicates', () => {
    // Models the reinstall-after-path-change scenario.
    const oldPatch = {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'node .claude/hooks/h.js' }] },
        ],
      },
    };
    const newPatch = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'node ${CLAUDE_PROJECT_DIR}/.claude/hooks/h.js' }],
          },
        ],
      },
    };
    const settings = mergeSettings({}, oldPatch);
    const stripped = subtractSettings(settings, oldPatch);
    const next = mergeSettings(stripped, newPatch);
    expect(next).toEqual(newPatch);
  });
});

// ── rewriteHookPaths ──────────────────────────────────────────────────────────

describe('rewriteHookPaths', () => {
  it('returns same object when patch is empty', () => {
    const empty = {};
    expect(rewriteHookPaths(empty, '/anything')).toBe(empty);
  });

  it('substitutes ~/.claude/hooks/ with target dir in nested commands', () => {
    const result = rewriteHookPaths(
      {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                { type: 'command', command: 'node ~/.claude/hooks/foo.js' },
                { type: 'command', command: 'node ~/.claude/hooks/bar.js arg' },
              ],
            },
          ],
        },
      },
      '${CLAUDE_PROJECT_DIR}/.claude/hooks',
    );
    expect(result).toEqual({
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [
              { type: 'command', command: 'node ${CLAUDE_PROJECT_DIR}/.claude/hooks/foo.js' },
              { type: 'command', command: 'node ${CLAUDE_PROJECT_DIR}/.claude/hooks/bar.js arg' },
            ],
          },
        ],
      },
    });
  });

  it('leaves unrelated strings untouched', () => {
    const result = rewriteHookPaths(
      { other: 'value with ~ in it', n: 1 },
      '/abs/hooks',
    );
    expect(result).toEqual({ other: 'value with ~ in it', n: 1 });
  });
});

// ── loadSettings ──────────────────────────────────────────────────────────────

describe('loadSettings', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns {} when file does not exist', async () => {
    vi.mocked(fsPromises.readFile).mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );
    const result = await loadSettings('/fake/settings.json');
    expect(result).toEqual({});
  });

  it('parses valid JSON object', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue(
      JSON.stringify({ foo: 'bar', arr: [1, 2] }),
    );
    const result = await loadSettings('/fake/settings.json');
    expect(result).toEqual({ foo: 'bar', arr: [1, 2] });
  });

  it('returns {} when JSON is not an object (array)', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue('[1,2,3]');
    const result = await loadSettings('/fake/settings.json');
    expect(result).toEqual({});
  });

  it('returns {} on JSON parse error', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue('not json');
    const result = await loadSettings('/fake/settings.json');
    expect(result).toEqual({});
  });
});

// ── writeSettings ─────────────────────────────────────────────────────────────

describe('writeSettings', () => {
  afterEach(() => vi.clearAllMocks());

  it('writes merged settings as formatted JSON', async () => {
    vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    await writeSettings('/fake/settings.json', { a: 1, b: [2, 3] });
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      '/fake/settings.json',
      JSON.stringify({ a: 1, b: [2, 3] }, null, 2) + '\n',
      'utf8',
    );
  });
});
