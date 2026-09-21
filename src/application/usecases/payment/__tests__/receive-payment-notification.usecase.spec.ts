import { CreditCardPaymentOrchestratorPort } from '@application/ports/credit-card-payment-orchestrator.port';

import { ReceivePaymentNotificationUseCase } from '../receive-payment-notification.usecase';

describe('ReceivePaymentNotificationUseCase', () => {
  it('deve entregar a notificação ao orquestrador', async () => {
    const orchestrator = {
      notify: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CreditCardPaymentOrchestratorPort>;

    await new ReceivePaymentNotificationUseCase(orchestrator).execute('mp-1');

    expect(orchestrator.notify).toHaveBeenCalledWith('mp-1');
  });
});
