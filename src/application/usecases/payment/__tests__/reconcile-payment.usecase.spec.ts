import { PaymentGatewayPort } from '@application/ports/payment-gateway.port';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentMethod, PaymentStatus } from '@domain/enums';
import { PaymentNotFoundException } from '@domain/exceptions';

import { ApplyGatewayPaymentUseCase } from '../apply-gateway-payment.usecase';
import { ReconcilePaymentUseCase } from '../reconcile-payment.usecase';

const PAYMENT_ID = 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';

const buildPayment = (status = PaymentStatus.PENDING): Payment =>
  Payment.create(
    PAYMENT_ID,
    '52998224725',
    'Mensalidade',
    149.9,
    PaymentMethod.CREDIT_CARD,
    status,
  );

describe('ReconcilePaymentUseCase', () => {
  let useCase: ReconcilePaymentUseCase;
  let repo: jest.Mocked<PaymentRepositoryContract>;
  let gateway: jest.Mocked<PaymentGatewayPort>;
  let applyGatewayPayment: jest.Mocked<ApplyGatewayPaymentUseCase>;

  beforeEach(() => {
    repo = {
      findById: jest.fn().mockResolvedValue(buildPayment()),
    } as unknown as jest.Mocked<PaymentRepositoryContract>;

    gateway = {
      findPaymentByExternalReference: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<PaymentGatewayPort>;

    applyGatewayPayment = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ApplyGatewayPaymentUseCase>;

    useCase = new ReconcilePaymentUseCase(repo, gateway, applyGatewayPayment);
  });

  it('deve falhar para um pagamento inexistente', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute(PAYMENT_ID)).rejects.toThrow(
      PaymentNotFoundException,
    );
  });

  it.each([PaymentStatus.PAID, PaymentStatus.FAIL])(
    'não deve consultar o provedor quando o pagamento já está %s',
    async (status) => {
      repo.findById.mockResolvedValue(buildPayment(status));

      await expect(useCase.execute(PAYMENT_ID)).resolves.toBe(status);
      expect(gateway.findPaymentByExternalReference).not.toHaveBeenCalled();
    },
  );

  it('deve devolver null enquanto o cliente não pagou', async () => {
    await expect(useCase.execute(PAYMENT_ID)).resolves.toBeNull();

    expect(gateway.findPaymentByExternalReference).toHaveBeenCalledWith(
      PAYMENT_ID,
    );
    expect(applyGatewayPayment.execute).not.toHaveBeenCalled();
  });

  it('deve aplicar o pagamento encontrado com as regras do webhook', async () => {
    const gatewayPayment = {
      providerPaymentId: 'mp-1',
      externalReference: PAYMENT_ID,
      status: PaymentStatus.PAID,
    };
    gateway.findPaymentByExternalReference.mockResolvedValue(gatewayPayment);
    applyGatewayPayment.execute.mockResolvedValue(
      buildPayment(PaymentStatus.PAID),
    );

    await expect(useCase.execute(PAYMENT_ID)).resolves.toBe(PaymentStatus.PAID);
    expect(applyGatewayPayment.execute).toHaveBeenCalledWith(gatewayPayment);
  });

  it('deve devolver null quando o provedor ainda processa a transação', async () => {
    gateway.findPaymentByExternalReference.mockResolvedValue({
      providerPaymentId: 'mp-1',
      externalReference: PAYMENT_ID,
      status: null,
    });
    applyGatewayPayment.execute.mockResolvedValue(buildPayment());

    await expect(useCase.execute(PAYMENT_ID)).resolves.toBeNull();
  });
});
