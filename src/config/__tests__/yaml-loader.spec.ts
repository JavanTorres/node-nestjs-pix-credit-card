import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadYamlConfig } from '../yaml-loader';

const writeConfigDir = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, 'utf8');
  }
  return dir;
};

describe('loadYamlConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('deve usar o default quando a variável não está definida', () => {
    delete process.env.POSTGRES_HOST;
    const dir = writeConfigDir({
      'default.yml': 'database:\n  host: ${POSTGRES_HOST:-localhost}\n',
    });

    expect(loadYamlConfig(dir)).toEqual({ database: { host: 'localhost' } });
  });

  it('deve substituir pela variável de ambiente quando definida', () => {
    process.env.POSTGRES_HOST = 'db.interno';
    const dir = writeConfigDir({
      'default.yml': 'database:\n  host: ${POSTGRES_HOST:-localhost}\n',
    });

    expect(loadYamlConfig(dir)).toEqual({ database: { host: 'db.interno' } });
  });

  it('deve preservar segredo com caracteres especiais do YAML', () => {
    process.env.POSTGRES_PASSWORD = 'p@ss: w#rd "quoted"';
    const dir = writeConfigDir({
      'default.yml': 'database:\n  password: ${POSTGRES_PASSWORD}\n',
    });

    expect(loadYamlConfig(dir)).toEqual({
      database: { password: 'p@ss: w#rd "quoted"' },
    });
  });

  it('deve mesclar o arquivo do ambiente sobre o default', () => {
    process.env.NODE_ENV = 'production';
    const dir = writeConfigDir({
      'default.yml': 'database:\n  host: localhost\n  synchronize: true\n',
      'production.yml': 'database:\n  synchronize: false\n',
    });

    expect(loadYamlConfig(dir)).toEqual({
      database: { host: 'localhost', synchronize: false },
    });
  });

  it('deve resolver variáveis dentro de listas', () => {
    process.env.CORS_ORIGIN = 'https://app.com';
    const dir = writeConfigDir({
      'default.yml': 'app:\n  corsOrigins:\n    - ${CORS_ORIGIN:-*}\n',
    });

    expect(loadYamlConfig(dir)).toEqual({
      app: { corsOrigins: ['https://app.com'] },
    });
  });

  it('deve ignorar arquivo de ambiente inexistente', () => {
    process.env.NODE_ENV = 'staging';
    const dir = writeConfigDir({ 'default.yml': 'app:\n  port: 3000\n' });

    expect(loadYamlConfig(dir)).toEqual({ app: { port: 3000 } });
  });
});
