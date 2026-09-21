import { HealthCheckController } from '../health-check.controller';
import { HealthCheckService } from '../health-check.service';

describe('HealthCheckController', () => {
  let controller: HealthCheckController;
  let service: jest.Mocked<HealthCheckService>;

  beforeEach(() => {
    service = {
      getStatus: jest.fn(),
    } as unknown as jest.Mocked<HealthCheckService>;
    controller = new HealthCheckController(service);
  });

  it('deve devolver o status vindo do service', () => {
    service.getStatus.mockReturnValue('OK');

    expect(controller.check()).toBe('OK');
    expect(service.getStatus).toHaveBeenCalledTimes(1);
  });
});
