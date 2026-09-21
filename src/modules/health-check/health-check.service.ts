import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthCheckService {
  getStatus(): string {
    return 'OK';
  }
}
