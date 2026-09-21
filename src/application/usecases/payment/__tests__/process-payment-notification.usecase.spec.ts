import { PaymentGatewayPort } from '@application/ports/payment-gateway.port';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentMethod, PaymentStatus } from '@domain/enums';

import { ApplyGatewayPaymentUseCase } from '../apply-gateway-payment.usecase';
import { ProcessPaymentNotificationUseCase } from '../process-payment-notification.usecase';

const PAYMENT_ID = 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';

const gatewayPayment = {
  providerPaymentId: 'mp-1',
  externalReference: PAYMENT_ID,
  status: PaymentStatus.PAID,
};

describe('ProcessPaymentNotificationUseCase', () => {
  let useCase: ProcessPaymentNotificationUseCase;
  let gateway: jest.Mocked<PaymentGatewayPort>;
  let applyGatewayPayment: jest.Mocked<ApplyGatewayPaymentUseCase>;

  beforeEach(() => {
    gateway = {
      fetchPayment: jest.fn().mockResolvedValue(gatewayPayment),
    } as unknown as jest.Mocked<PaymentGatewayPort>;

    applyGatewayPayment = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ApplyGatewayPaymentUseCase>;

    useCase = new ProcessPaymentNotificationUseCase(
      gateway,
      applyGatewayPayment,
    );
  });

  it('deve consultar o provedor e aplicar o que ele devolver', async () => {
    const paid = Payment.create(
      PAYMENT_ID,
      '52998224725',
      'Compra',
      99.9,
      PaymentMethod.CREDIT_CARD,
      PaymentStatus.PAID,
    );
    applyGatewayPayment.execute.mockResolvedValue(paid);

    await expect(useCase.execute('mp-1')).resolves.toBe(paid);

    expect(gateway.fetchPayment).toHaveBeenCalledWith('mp-1');
    expect(applyGatewayPayment.execute).toHaveBeenCalledWith(gatewayPayment);
  });

  it('não deve aplicar nada quando a consulta ao provedor falha', async () => {
    gateway.fetchPayment.mockRejectedValue(new Error('provedor fora'));

    await expect(useCase.execute('mp-1')).rejects.toThrow('provedor fora');
    expect(applyGatewayPayment.execute).not.toHaveBeenCalled();
  });
});
