import { HealthCheckService } from '../health-check.service';

describe('HealthCheckService', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    service = new HealthCheckService();
  });

  it('deve retornar OK', () => {
    expect(service.getStatus()).toBe('OK');
  });
});
