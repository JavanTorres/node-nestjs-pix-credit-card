import { PaymentGatewayPort } from '@application/ports/payment-gateway.port';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentMethod, PaymentStatus } from '@domain/enums';

import { StartCheckoutUseCase } from '../start-checkout.usecase';

const PAYMENT_ID = 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';

const buildPayment = (): Payment =>
  Payment.create(
    PAYMENT_ID,
    '52998224725',
    'Mensalidade',
    149.9,
    PaymentMethod.CREDIT_CARD,
  );

describe('StartCheckoutUseCase', () => {
  let useCase: StartCheckoutUseCase;
  let repo: jest.Mocked<PaymentRepositoryContract>;
  let gateway: jest.Mocked<PaymentGatewayPort>;

  beforeEach(() => {
    repo = {
      update: jest.fn(async (payment: Payment) => payment),
    } as unknown as jest.Mocked<PaymentRepositoryContract>;

    gateway = {
      createCheckoutPreference: jest.fn().mockResolvedValue({
        externalId: 'pref-123',
        initPoint: 'https://mercadopago.com/checkout/pref-123',
      }),
    } as unknown as jest.Mocked<PaymentGatewayPort>;

    const logger = { log: jest.fn(), warn: jest.fn() };

    useCase = new StartCheckoutUseCase(repo, gateway, logger);
  });

  it('deve criar a preferência e gravar externalId e checkoutUrl', async () => {
    const result = await useCase.execute(buildPayment());

    expect(gateway.createCheckoutPreference).toHaveBeenCalledTimes(1);
    expect(result.externalId).toBe('pref-123');
    expect(result.checkoutUrl).toBe(
      'https://mercadopago.com/checkout/pref-123',
    );
    expect(repo.update.mock.calls[0][0].checkoutUrl).toBe(
      'https://mercadopago.com/checkout/pref-123',
    );
  });

  it('deve manter o pagamento PENDING', async () => {
    const result = await useCase.execute(buildPayment());

    expect(result.status).toBe(PaymentStatus.PENDING);
  });

  it('deve ser idempotente quando o checkout já existe', async () => {
    const linked = buildPayment().withCheckout('pref-1', 'https://mp.com/1');

    const result = await useCase.execute(linked);

    expect(result).toBe(linked);
    expect(gateway.createCheckoutPreference).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('deve propagar a falha do gateway sem gravar nada', async () => {
    gateway.createCheckoutPreference.mockRejectedValue(
      new Error('gateway indisponível'),
    );

    await expect(useCase.execute(buildPayment())).rejects.toThrow(
      'gateway indisponível',
    );
    expect(repo.update).not.toHaveBeenCalled();
  });
});
