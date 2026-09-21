import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { appConfig } from './config/configuration';
import { createSwaggerDocument } from './infrastructure/swagger/create-swagger-document.helper';
import { RoutesV1Module } from './modules/routes-v1.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.enableShutdownHooks();

  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  configureApp(app, { corsOrigins: config.corsOrigins });

  const documentV1 = createSwaggerDocument(app, 'v1', '1.0', [RoutesV1Module]);
  SwaggerModule.setup('api-docs-v1', app, documentV1);

  const { port } = config;

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`Aplicação rodando em http://localhost:${port}`);
  logger.log(`Swagger em http://localhost:${port}/api-docs-v1`);
}

bootstrap();
