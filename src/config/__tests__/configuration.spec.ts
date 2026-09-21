import { appConfig, databaseConfig, mercadoPagoConfig } from '../configuration';

const loadFresh = async () => {
  let loaded: typeof import('../configuration');

  await jest.isolateModulesAsync(async () => {
    loaded = await import('../configuration');
  });

  return loaded!;
};

describe('loadConfiguration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('deve carregar a configuração a partir dos YAMLs do projeto', async () => {
    const { loadConfiguration } = await loadFresh();

    const config = loadConfiguration();

    expect(config.app.env).toBe('development');
    expect(config.database.host).toBe('localhost');
    expect(config.mercadoPago.timeoutMs).toBeGreaterThan(0);
  });

  it('deve refletir a variável de ambiente na configuração', async () => {
    process.env.POSTGRES_HOST = 'db.interno';
    const { loadConfiguration } = await loadFresh();

    expect(loadConfiguration().database.host).toBe('db.interno');
  });

  it('deve memoizar: a segunda chamada devolve a mesma instância', async () => {
    const { loadConfiguration } = await loadFresh();

    expect(loadConfiguration()).toBe(loadConfiguration());
  });

  it('deve lançar com a lista de problemas quando a config for inválida', async () => {
    process.env.NODE_ENV = 'production';
    process.env.POSTGRES_HOST = '';
    process.env.POSTGRES_USER = '';
    process.env.POSTGRES_PASSWORD = '';
    process.env.MERCADO_PAGO_ACCESS_TOKEN = '';
    process.env.MERCADO_PAGO_NOTIFICATION_URL = '';

    const { loadConfiguration } = await loadFresh();

    expect(() => loadConfiguration()).toThrow(/Configuração inválida/);
  });

  it('deve citar cada campo problemático na mensagem', async () => {
    process.env.NODE_ENV = 'production';
    process.env.POSTGRES_HOST = '';
    process.env.POSTGRES_USER = 'postgres';
    process.env.POSTGRES_PASSWORD = 'secret';
    process.env.MERCADO_PAGO_ACCESS_TOKEN = '';
    process.env.MERCADO_PAGO_NOTIFICATION_URL = 'https://app/webhook';

    const { loadConfiguration } = await loadFresh();

    expect(() => loadConfiguration()).toThrow(/database\.host/);
    expect(() => loadConfiguration()).toThrow(/mercadoPago\.accessToken/);
  });
});

describe('namespaces', () => {
  it.each([
    ['app', appConfig],
    ['database', databaseConfig],
    ['mercadoPago', mercadoPagoConfig],
  ])('deve registrar o namespace %s com token próprio', (name, namespace) => {
    expect(namespace.KEY).toContain(name);
  });

  it('deve expor o recorte correspondente da configuração', () => {
    expect(databaseConfig()).toHaveProperty('host');
    expect(mercadoPagoConfig()).toHaveProperty('timeoutMs');
    expect(appConfig()).toHaveProperty('port');
  });
});
