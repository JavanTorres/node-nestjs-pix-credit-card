import { configSchema } from '../config.schema';

const validConfig = () => ({
  app: { env: 'development', port: 3000, corsOrigins: ['*'] },
  database: {
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    name: 'payments',
    synchronize: true,
    logging: true,
  },
  mercadoPago: {
    accessToken: '',
    notificationUrl: 'http://localhost:3000/api/payment/webhook',
    webhookSecret: '',
    backUrl: '',
    timeoutMs: 10000,
  },
});

describe('configSchema', () => {
  it('deve aceitar uma configuração válida', () => {
    expect(configSchema.safeParse(validConfig()).success).toBe(true);
  });

  it('deve converter number vindo como string do ambiente', () => {
    const config = validConfig();
    config.app.port = '8080' as never;

    const result = configSchema.parse(config);

    expect(result.app.port).toBe(8080);
  });

  it.each([
    ['false', false],
    ['0', false],
    ['true', true],
    ['1', true],
  ])('deve interpretar o booleano "%s" corretamente', (input, expected) => {
    const config = validConfig();
    config.database.logging = input as never;

    expect(configSchema.parse(config).database.logging).toBe(expected);
  });

  it('deve recusar porta inválida', () => {
    const config = validConfig();
    config.app.port = 0;

    expect(configSchema.safeParse(config).success).toBe(false);
  });

  it('deve recusar senha vazia', () => {
    const config = validConfig();
    config.database.password = '';

    expect(configSchema.safeParse(config).success).toBe(false);
  });

  describe('em produção', () => {
    const productionConfig = () => {
      const config = validConfig();
      config.app.env = 'production';
      config.database.synchronize = false;
      config.mercadoPago.accessToken = 'APP-token';
      config.mercadoPago.webhookSecret = 'segredo-do-painel';
      return config;
    };

    it('deve aceitar configuração de produção completa', () => {
      expect(configSchema.safeParse(productionConfig()).success).toBe(true);
    });

    it('deve recusar synchronize ligado', () => {
      const config = productionConfig();
      config.database.synchronize = true;

      const result = configSchema.safeParse(config);

      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error)).toContain('migrations');
    });

    it('deve exigir o access token do Mercado Pago', () => {
      const config = productionConfig();
      config.mercadoPago.accessToken = '';

      expect(configSchema.safeParse(config).success).toBe(false);
    });

    it('deve exigir a notification url', () => {
      const config = productionConfig();
      config.mercadoPago.notificationUrl = '';

      expect(configSchema.safeParse(config).success).toBe(false);
    });

    it('deve exigir o segredo do webhook', () => {
      const config = productionConfig();
      config.mercadoPago.webhookSecret = '';

      const result = configSchema.safeParse(config);

      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error)).toContain(
        'MERCADO_PAGO_WEBHOOK_SECRET',
      );
    });

    it('não deve exigir a back url', () => {
      const config = productionConfig();
      config.mercadoPago.backUrl = '';

      expect(configSchema.safeParse(config).success).toBe(true);
    });
  });

  describe('temporal', () => {
    it('deve ficar desligado quando a seção não existe', () => {
      const result = configSchema.parse(validConfig());

      expect(result.temporal).toEqual({
        enabled: false,
        address: 'localhost:7233',
        namespace: 'default',
        taskQueue: 'payments',
        runWorker: true,
        checkoutWaitMs: 15000,
        pollIntervalSeconds: 30,
        paymentTimeoutMinutes: 60,
      });
    });

    it('deve aceitar os valores vindos do ambiente como string', () => {
      const result = configSchema.parse({
        ...validConfig(),
        temporal: {
          enabled: 'true',
          runWorker: 'false',
          pollIntervalSeconds: '10',
        },
      });

      expect(result.temporal.enabled).toBe(true);
      expect(result.temporal.runWorker).toBe(false);
      expect(result.temporal.pollIntervalSeconds).toBe(10);
    });

    it('deve recusar um intervalo de polling não positivo', () => {
      const result = configSchema.safeParse({
        ...validConfig(),
        temporal: { pollIntervalSeconds: 0 },
      });

      expect(result.success).toBe(false);
    });
  });
});
