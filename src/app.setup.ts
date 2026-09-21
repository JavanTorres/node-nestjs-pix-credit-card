import {
  BadRequestException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';

import { DomainExceptionFilter } from './presentation/filters/domain-exception.filter';
import { PaymentGatewayExceptionFilter } from './presentation/filters/payment-gateway-exception.filter';

interface AppSetupOptions {
  corsOrigins: string[];
}

export function configureApp(
  app: INestApplication,
  { corsOrigins }: AppSetupOptions,
): void {
  app.enableCors({ origin: corsOrigins, exposedHeaders: ['X-Total-Count'] });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalFilters(
    new DomainExceptionFilter(),
    new PaymentGatewayExceptionFilter(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory(errors) {
        const formatError = (err: any, path = ''): string[] => {
          const currentPath = path ? `${path}.${err.property}` : err.property;

          if (err.children && err.children.length > 0) {
            return err.children.flatMap((child: any) =>
              formatError(child, currentPath),
            );
          }

          if (err.constraints) {
            return Object.values(err.constraints).map(
              (constraint: any) => `${currentPath}: ${constraint}`,
            );
          }

          return [`${currentPath}: validation failed`];
        };

        const messages = errors.flatMap((err) => formatError(err));

        return new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Erro de validação',
          message: messages,
        });
      },
    }),
  );
}
