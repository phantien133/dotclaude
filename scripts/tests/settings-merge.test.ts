import { describe, it, expect, vi, afterEach } from 'vitest';
import { mergeSettings, loadSettings, writeSettings } from '../lib/settings-merge.ts';

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
