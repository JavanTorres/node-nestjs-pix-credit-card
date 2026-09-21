import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { load } from 'js-yaml';

import { normalizeEnvironment } from './environment';

const PLACEHOLDER = /\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g;

type Plain = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Plain =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function interpolate(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(
      PLACEHOLDER,
      (_match, name: string, fallback?: string) =>
        process.env[name] ?? fallback ?? '',
    );
  }

  if (Array.isArray(value)) return value.map(interpolate);

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, interpolate(item)]),
    );
  }

  return value;
}

function deepMerge(base: Plain, override: Plain): Plain {
  const result: Plain = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const current = result[key];

    result[key] =
      isPlainObject(current) && isPlainObject(value)
        ? deepMerge(current, value)
        : value;
  }

  return result;
}

function readYaml(path: string): Plain {
  if (!existsSync(path)) return {};

  const parsed = load(readFileSync(path, 'utf8'));
  return isPlainObject(parsed) ? parsed : {};
}

export function loadYamlConfig(
  configDir = join(process.cwd(), 'config'),
): Plain {
  const env = normalizeEnvironment(process.env.NODE_ENV);

  const merged = deepMerge(
    readYaml(join(configDir, 'default.yml')),
    readYaml(join(configDir, `${env}.yml`)),
  );

  return interpolate(merged) as Plain;
}
