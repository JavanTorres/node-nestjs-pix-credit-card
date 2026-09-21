import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';

import { createSwaggerDocument } from '../create-swagger-document.helper';

describe('createSwaggerDocument', () => {
  const app = {} as INestApplication;
  let createDocument: jest.SpyInstance;

  beforeEach(() => {
    createDocument = jest
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue({ openapi: '3.0.0' } as never);
  });

  afterEach(() => {
    createDocument.mockRestore();
  });

  it('deve montar o documento com título e versão da API', () => {
    createSwaggerDocument(app, 'v1', '1.0');

    const [, config] = createDocument.mock.calls[0];

    expect(config.info.title).toBe('DOC V1.');
    expect(config.info.version).toBe('1.0');
    expect(config.info.description).toContain('V1.');
  });

  it('deve repassar os módulos a incluir e varrer rotas aninhadas', () => {
    class FakeModule {}

    createSwaggerDocument(app, 'v1', '1.0', [FakeModule]);

    const [, , options] = createDocument.mock.calls[0];

    expect(options.include).toEqual([FakeModule]);
    expect(options.deepScanRoutes).toBe(true);
  });

  it('deve usar v1/1.0 como padrão', () => {
    createSwaggerDocument(app);

    const [, config] = createDocument.mock.calls[0];

    expect(config.info.title).toBe('DOC V1.');
    expect(config.info.version).toBe('1.0');
  });
});
