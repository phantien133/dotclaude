import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PresetSchema, SidecarSchema, ManifestSchema } from './lib/schema.ts';

const REPO_ROOT = new URL('..', import.meta.url).pathname;

interface Target {
  schema: Parameters<typeof zodToJsonSchema>[0];
  outPath: string;
  title: string;
  $id: string;
}

const targets: Target[] = [
  {
    schema: PresetSchema,
    outPath: join(REPO_ROOT, 'presets/schema/preset.schema.json'),
    title: 'dotclaude Preset',
    $id: 'https://phantien133.github.io/dotclaude/schema/preset.schema.json',
  },
  {
    schema: SidecarSchema,
    outPath: join(REPO_ROOT, 'presets/schema/sidecar.schema.json'),
    title: 'dotclaude Sidecar (provenance + dependencies)',
    $id: 'https://phantien133.github.io/dotclaude/schema/sidecar.schema.json',
  },
  {
    schema: ManifestSchema,
    outPath: join(REPO_ROOT, 'presets/schema/manifest.schema.json'),
    title: 'dotclaude Install Manifest',
    $id: 'https://phantien133.github.io/dotclaude/schema/manifest.schema.json',
  },
];

async function generate(): Promise<void> {
  for (const target of targets) {
    const json = zodToJsonSchema(target.schema, {
      $refStrategy: 'none',
      target: 'jsonSchema7',
    }) as Record<string, unknown>;

    json['$schema'] = 'http://json-schema.org/draft-07/schema#';
    json['$id'] = target.$id;
    json['title'] = target.title;

    const formatted = JSON.stringify(json, null, 2) + '\n';
    await writeFile(target.outPath, formatted, 'utf8');
    console.log(`wrote ${target.outPath}`);
  }
}

generate().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
