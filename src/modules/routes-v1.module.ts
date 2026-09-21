import { Module } from '@nestjs/common';

import { HealthCheckModule } from './health-check/health-check.module';
import { PaymentModule } from './payment.module';

@Module({
  imports: [HealthCheckModule, PaymentModule],
})
export class RoutesV1Module {}
