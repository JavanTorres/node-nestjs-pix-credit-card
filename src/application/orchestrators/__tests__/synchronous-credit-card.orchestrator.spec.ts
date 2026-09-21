import { ProcessPaymentNotificationUseCase } from '@application/usecases/payment/process-payment-notification.usecase';
import { StartCheckoutUseCase } from '@application/usecases/payment/start-checkout.usecase';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentMethod } from '@domain/enums';

import { SynchronousCreditCardOrchestrator } from '../synchronous-credit-card.orchestrator';

const buildPayment = (): Payment =>
  Payment.create(
    'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
    '52998224725',
    'Mensalidade',
    149.9,
    PaymentMethod.CREDIT_CARD,
  );

describe('SynchronousCreditCardOrchestrator', () => {
  let orchestrator: SynchronousCreditCardOrchestrator;
  let repo: jest.Mocked<PaymentRepositoryContract>;
  let startCheckout: jest.Mocked<StartCheckoutUseCase>;
  let processNotification: jest.Mocked<ProcessPaymentNotificationUseCase>;

  beforeEach(() => {
    repo = {
      create: jest.fn(async (payment: Payment) => payment),
    } as unknown as jest.Mocked<PaymentRepositoryContract>;

    startCheckout = {
      execute: jest.fn(async (payment: Payment) =>
        payment.withCheckout('pref-1', 'https://mp.com/1'),
      ),
    } as unknown as jest.Mocked<StartCheckoutUseCase>;

    processNotification = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ProcessPaymentNotificationUseCase>;

    orchestrator = new SynchronousCreditCardOrchestrator(
      repo,
      startCheckout,
      processNotification,
    );
  });

  it('deve gravar PENDING antes de criar a preferência', async () => {
    const payment = buildPayment();

    const result = await orchestrator.start(payment);

    expect(repo.create).toHaveBeenCalledWith(payment);
    expect(repo.create.mock.invocationCallOrder[0]).toBeLessThan(
      startCheckout.execute.mock.invocationCallOrder[0],
    );
    expect(result.checkoutUrl).toBe('https://mp.com/1');
  });

  it('deve propagar a falha da preferência (fica PENDING sem checkout)', async () => {
    startCheckout.execute.mockRejectedValue(new Error('provedor fora'));

    await expect(orchestrator.start(buildPayment())).rejects.toThrow(
      'provedor fora',
    );
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('deve processar a notificação na própria request', async () => {
    await orchestrator.notify('mp-1');

    expect(processNotification.execute).toHaveBeenCalledWith('mp-1');
  });
});
