import { z } from 'zod';

import { ENVIRONMENTS, normalizeEnvironment } from './environment';

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

const positiveInt = z.coerce.number().int().positive();

const optionalText = z
  .string()
  .default('')
  .transform((value) => value.trim());

export const configSchema = z
  .object({
    app: z.object({
      env: z.preprocess(
        (value) =>
          typeof value === 'string' ? normalizeEnvironment(value) : value,
        z.enum(ENVIRONMENTS),
      ),
      port: positiveInt,
      corsOrigins: z.array(z.string().min(1)).min(1),
    }),

    database: z.object({
      host: z.string().min(1),
      port: positiveInt,
      username: z.string().min(1),
      password: z.string().min(1),
      name: z.string().min(1),
      synchronize: booleanish,
      migrationsRun: booleanish.default(true),
      logging: booleanish,
    }),

    mercadoPago: z.object({
      accessToken: optionalText,
      notificationUrl: optionalText,
      webhookSecret: optionalText,
      backUrl: optionalText,
      timeoutMs: positiveInt,
    }),

    temporal: z
      .object({
        enabled: booleanish.default(false),
        address: z.string().min(1).default('localhost:7233'),
        namespace: z.string().min(1).default('default'),
        taskQueue: z.string().min(1).default('payments'),
        runWorker: booleanish.default(true),
        checkoutWaitMs: positiveInt.default(15000),
        pollIntervalSeconds: positiveInt.default(30),
        paymentTimeoutMinutes: positiveInt.default(60),
      })
      .prefault({}),
  })
  .superRefine((config, ctx) => {
    if (config.app.env !== 'production') return;

    if (config.database.synchronize) {
      ctx.addIssue({
        code: 'custom',
        path: ['database', 'synchronize'],
        message:
          'synchronize deve ser false em produção — use migrations do TypeORM.',
      });
    }

    if (!config.mercadoPago.accessToken) {
      ctx.addIssue({
        code: 'custom',
        path: ['mercadoPago', 'accessToken'],
        message:
          'MERCADO_PAGO_ACCESS_TOKEN é obrigatório em produção (o gateway ' +
          'simulado não pode ser usado).',
      });
    }

    if (!config.mercadoPago.notificationUrl) {
      ctx.addIssue({
        code: 'custom',
        path: ['mercadoPago', 'notificationUrl'],
        message:
          'MERCADO_PAGO_NOTIFICATION_URL é obrigatório em produção para ' +
          'receber o callback.',
      });
    }

    if (!config.mercadoPago.webhookSecret) {
      ctx.addIssue({
        code: 'custom',
        path: ['mercadoPago', 'webhookSecret'],
        message:
          'MERCADO_PAGO_WEBHOOK_SECRET é obrigatório em produção: sem ele o ' +
          'webhook aceita qualquer POST e um terceiro marca cobranças como pagas.',
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;
