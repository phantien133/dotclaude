import yaml from 'js-yaml';

const LOAD_OPTS: yaml.LoadOptions = {
  schema: yaml.CORE_SCHEMA,
};

const DUMP_OPTS: yaml.DumpOptions = {
  schema: yaml.CORE_SCHEMA,
  indent: 2,
  lineWidth: 100,
  noRefs: true,
  sortKeys: false,
};

export function loadYaml<T = unknown>(raw: string): T {
  return yaml.load(raw, LOAD_OPTS) as T;
}

export function dumpYaml(data: unknown): string {
  return yaml.dump(data, DUMP_OPTS);
}
