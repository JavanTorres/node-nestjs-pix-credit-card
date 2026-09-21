import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { AppConfig, configSchema } from './config.schema';
import { loadYamlConfig } from './yaml-loader';

let cached: AppConfig | null = null;

export function loadConfiguration(): AppConfig {
  if (cached) return cached;

  const result = configSchema.safeParse(loadYamlConfig());

  if (!result.success) {
    throw new Error(
      `Configuração inválida:\n${z.prettifyError(result.error)}\n\n` +
        'Verifique os arquivos em config/ e as variáveis de ambiente.',
    );
  }

  cached = result.data;
  return cached;
}

export const appConfig = registerAs('app', () => loadConfiguration().app);

export const databaseConfig = registerAs(
  'database',
  () => loadConfiguration().database,
);

export const mercadoPagoConfig = registerAs(
  'mercadoPago',
  () => loadConfiguration().mercadoPago,
);

export const temporalConfig = registerAs(
  'temporal',
  () => loadConfiguration().temporal,
);
