import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { HealthCheckService } from './health-check.service';

@Controller({
  path: 'health-check',
  version: '1',
})
@ApiTags('Health Check')
export class HealthCheckController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @Get()
  check(): string {
    return this.healthCheckService.getStatus();
  }
}
