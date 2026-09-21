const ALIASES: Record<string, string> = {
  dev: 'development',
  develop: 'development',
  local: 'development',
  testing: 'test',
  prod: 'production',
};

export const ENVIRONMENTS = ['development', 'test', 'production'] as const;

export function normalizeEnvironment(value: string | undefined): string {
  const normalized = (value ?? 'development').trim().toLowerCase();
  return ALIASES[normalized] ?? normalized;
}
