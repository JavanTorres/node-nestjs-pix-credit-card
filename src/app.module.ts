import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import {
  appConfig,
  databaseConfig,
  mercadoPagoConfig,
  temporalConfig,
} from './config/configuration';
import { RoutesV1Module } from './modules/routes-v1.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [appConfig, databaseConfig, mercadoPagoConfig, temporalConfig],
      cache: true,
    }),
    RoutesV1Module,
  ],
})
export class AppModule {}
