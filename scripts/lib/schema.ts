import { z } from 'zod';

export const COMPONENT_TYPES = ['agents', 'skills', 'commands', 'hooks', 'rules'] as const;
export const ComponentTypeSchema = z.enum(COMPONENT_TYPES);
export type ComponentType = z.infer<typeof ComponentTypeSchema>;

export const PRESET_KINDS = ['core', 'framework', 'purpose'] as const;
export const PresetKindSchema = z.enum(PRESET_KINDS);
export type PresetKind = z.infer<typeof PresetKindSchema>;

export const EXTERNAL_DEP_TYPES = ['npm', 'system_binary', 'python_pkg'] as const;
export const ExternalDepTypeSchema = z.enum(EXTERNAL_DEP_TYPES);

const ComponentRefListSchema = z
  .object({
    agents: z.array(z.string()).default([]),
    skills: z.array(z.string()).default([]),
    commands: z.array(z.string()).default([]),
    hooks: z.array(z.string()).default([]),
    rules: z.array(z.string()).default([]),
  })
  .strict();
export type ComponentRefList = z.infer<typeof ComponentRefListSchema>;

const ExternalDepSchema = z
  .object({
    name: z.string().min(1),
    type: ExternalDepTypeSchema,
    version: z.string().optional(),
    reason: z.string().optional(),
  })
  .strict();
export type ExternalDep = z.infer<typeof ExternalDepSchema>;

const SourceSchema = z
  .object({
    repo: z.string().url(),
    commit: z
      .string()
      .regex(/^[0-9a-f]{40}$/i, 'commit must be full 40-char SHA-1 hex'),
    path: z.string().min(1),
    ref: z.string().min(1),
  })
  .strict();
export type Source = z.infer<typeof SourceSchema>;

export const SidecarDependenciesSchema = z
  .object({
    required: ComponentRefListSchema.default({
      agents: [],
      skills: [],
      commands: [],
      hooks: [],
      rules: [],
    }),
    optional: ComponentRefListSchema.default({
      agents: [],
      skills: [],
      commands: [],
      hooks: [],
      rules: [],
    }),
    external: z.array(ExternalDepSchema).default([]),
  })
  .strict();
export type SidecarDependencies = z.infer<typeof SidecarDependenciesSchema>;

export const SidecarSchema = z
  .object({
    source: SourceSchema,
    imported_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'imported_at must be ISO date YYYY-MM-DD'),
    license: z.string().min(1),
    modified: z.boolean(),
    modifications: z.string().nullable().default(null),
    notes: z.string().nullable().default(null),
    dependencies: SidecarDependenciesSchema.default({
      required: { agents: [], skills: [], commands: [], hooks: [], rules: [] },
      optional: { agents: [], skills: [], commands: [], hooks: [], rules: [] },
      external: [],
    }),
  })
  .strict();
export type Sidecar = z.infer<typeof SidecarSchema>;

export const PresetSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .regex(/^[a-z][a-z0-9-]*$/, 'preset name must be lowercase kebab-case'),
    kind: PresetKindSchema,
    description: z.string().min(1),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/, 'version must be SemVer X.Y.Z'),
    extends: z.array(z.string().min(1)).default([]),
    components: ComponentRefListSchema.default({
      agents: [],
      skills: [],
      commands: [],
      hooks: [],
      rules: [],
    }),
    settings_patch: z.record(z.string(), z.unknown()).default({}),
    tags: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type Preset = z.infer<typeof PresetSchema>;

const InstalledComponentSchema = z
  .object({
    type: z.enum(['agent', 'skill', 'command', 'hook', 'rule']),
    id: z.string().min(1),
    target_path: z.string().min(1),
    mode: z.enum(['symlink', 'copy']),
    source_path: z.string().min(1),
    source_commit: z.string().nullable(),
    preset: z.string().min(1),
    auto_included: z.boolean().default(false),
    required_by: z.array(z.string()).default([]),
  })
  .strict();
export type InstalledComponent = z.infer<typeof InstalledComponentSchema>;

const InstalledPresetSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    kind: PresetKindSchema,
  })
  .strict();
export type InstalledPreset = z.infer<typeof InstalledPresetSchema>;

const SettingsPatchEntrySchema = z
  .object({
    preset: z.string().min(1),
    patch_keys: z.array(z.string()).default([]),
  })
  .strict();
export type SettingsPatchEntry = z.infer<typeof SettingsPatchEntrySchema>;

const ExternalDepProbeSchema = ExternalDepSchema.extend({
  found: z.boolean(),
  detected_version: z.string().nullable().default(null),
  requested_by: z.array(z.string()).default([]),
}).strict();
export type ExternalDepProbe = z.infer<typeof ExternalDepProbeSchema>;

export const ManifestSchema = z
  .object({
    schema_version: z.literal(1),
    installed_at: z.string().datetime({ offset: true }),
    presets: z.array(InstalledPresetSchema),
    components: z.array(InstalledComponentSchema),
    settings_patches: z.array(SettingsPatchEntrySchema).default([]),
    external_deps: z.array(ExternalDepProbeSchema).default([]),
  })
  .strict();
export type Manifest = z.infer<typeof ManifestSchema>;
