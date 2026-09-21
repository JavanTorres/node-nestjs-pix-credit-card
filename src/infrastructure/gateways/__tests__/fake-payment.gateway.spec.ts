import { PaymentGatewayException } from '@application/exceptions/payment-gateway.exception';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentMethod, PaymentStatus } from '@domain/enums';

import { FakePaymentGateway } from '../fake-payment.gateway';

const PAYMENT_ID = 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';

const buildPayment = (id = PAYMENT_ID): Payment =>
  Payment.create(id, '52998224725', 'Compra', 99.9, PaymentMethod.CREDIT_CARD);

describe('FakePaymentGateway', () => {
  let gateway: FakePaymentGateway;

  beforeEach(() => {
    gateway = new FakePaymentGateway();
  });

  it('deve devolver uma preferência com id e init point', async () => {
    const preference = await gateway.createCheckoutPreference(buildPayment());

    expect(preference.externalId).toMatch(/^fake-pref-/);
    expect(preference.initPoint).toContain(preference.externalId);
  });

  it('deve gerar ids distintos a cada chamada', async () => {
    const first = await gateway.createCheckoutPreference(buildPayment());
    const second = await gateway.createCheckoutPreference(
      buildPayment('a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d'),
    );

    expect(first.externalId).not.toBe(second.externalId);
  });

  it('deve registrar o pagamento simulado como aprovado', async () => {
    const payment = buildPayment();
    await gateway.createCheckoutPreference(payment);

    const providerPaymentId = (
      gateway as unknown as { payments: Map<string, unknown> }
    ).payments
      .keys()
      .next().value as string;

    const fetched = await gateway.fetchPayment(providerPaymentId);

    expect(fetched.externalReference).toBe(payment.id);
    expect(fetched.status).toBe(PaymentStatus.PAID);
    expect(fetched.providerPaymentId).toBe(providerPaymentId);
  });

  it('deve lançar erro do gateway para um pagamento desconhecido', async () => {
    await expect(gateway.fetchPayment('nao-existe')).rejects.toThrow(
      PaymentGatewayException,
    );
  });

  it('não deve "aprovar sozinho" na reconciliação por polling', async () => {
    const payment = buildPayment();
    await gateway.createCheckoutPreference(payment);

    await expect(gateway.findPaymentByExternalReference()).resolves.toBeNull();
  });
});
