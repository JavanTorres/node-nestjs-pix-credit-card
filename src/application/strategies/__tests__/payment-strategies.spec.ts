import { CreditCardPaymentOrchestratorPort } from '@application/ports/credit-card-payment-orchestrator.port';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentMethod } from '@domain/enums';

import { CreditCardPaymentStrategy } from '../credit-card-payment.strategy';
import { PixPaymentStrategy } from '../pix-payment.strategy';

const buildPayment = (paymentMethod: PaymentMethod): Payment =>
  Payment.create(
    'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
    '52998224725',
    'Compra',
    99.9,
    paymentMethod,
  );

describe('Estratégias por meio de pagamento', () => {
  it('PIX deve apenas gravar o pagamento', async () => {
    const repo = {
      create: jest.fn(async (payment: Payment) => payment),
    } as unknown as jest.Mocked<PaymentRepositoryContract>;
    const strategy = new PixPaymentStrategy(repo);
    const payment = buildPayment(PaymentMethod.PIX);

    await expect(strategy.process(payment)).resolves.toBe(payment);
    expect(strategy.method).toBe(PaymentMethod.PIX);
    expect(repo.create).toHaveBeenCalledWith(payment);
  });

  it('CREDIT_CARD deve delegar ao orquestrador', async () => {
    const orchestrator = {
      start: jest.fn(async (payment: Payment) =>
        payment.withCheckout('pref-1', 'https://mp.com/1'),
      ),
    } as unknown as jest.Mocked<CreditCardPaymentOrchestratorPort>;
    const strategy = new CreditCardPaymentStrategy(orchestrator);

    const result = await strategy.process(
      buildPayment(PaymentMethod.CREDIT_CARD),
    );

    expect(strategy.method).toBe(PaymentMethod.CREDIT_CARD);
    expect(result.checkoutUrl).toBe('https://mp.com/1');
  });
});
