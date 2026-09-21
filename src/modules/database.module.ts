import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { databaseConfig } from '@config/configuration';
import { PaymentOrmEntity } from '@infrastructure/database/entities/payment.orm-entity';
import { buildTypeOrmOptions } from '@infrastructure/database/typeorm.options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>) =>
        buildTypeOrmOptions(config),
    }),
    TypeOrmModule.forFeature([PaymentOrmEntity]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
