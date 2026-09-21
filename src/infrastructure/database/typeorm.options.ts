import { DataSourceOptions } from 'typeorm';

import { AppConfig } from '@config/config.schema';

import { PaymentOrmEntity } from './entities/payment.orm-entity';
import { CreatePayments1758456000000 } from './migrations/1758456000000-create-payments';

export const buildTypeOrmOptions = (
  config: AppConfig['database'],
): DataSourceOptions => ({
  type: 'postgres',
  host: config.host,
  port: config.port,
  username: config.username,
  password: config.password,
  database: config.name,
  entities: [PaymentOrmEntity],
  migrations: [CreatePayments1758456000000],
  migrationsRun: config.migrationsRun,
  synchronize: config.synchronize,
  logging: config.logging,
});
