import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createSwaggerDocument(
  app: INestApplication,
  apiVersion = 'v1',
  docVersion = '1.0',
  modulesToInclude: any[] = [],
) {
  const config = new DocumentBuilder()
    .setTitle(`DOC ${apiVersion.toUpperCase()}.`)
    .setDescription(
      `API de cobranças via PIX e Cartão de Crédito ${apiVersion.toUpperCase()}.`,
    )
    .setVersion(docVersion)
    .build();

  return SwaggerModule.createDocument(app, config, {
    include: modulesToInclude,
    deepScanRoutes: true,
  });
}
