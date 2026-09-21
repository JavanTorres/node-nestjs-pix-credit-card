import { PaymentGatewayPort } from '@application/ports/payment-gateway.port';
import { Payment } from '@domain/entities/payment.entity';

import { ApplyGatewayPaymentUseCase } from './apply-gateway-payment.usecase';

export class ProcessPaymentNotificationUseCase {
  constructor(
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly applyGatewayPayment: ApplyGatewayPaymentUseCase,
  ) {}

  async execute(providerPaymentId: string): Promise<Payment | null> {
    const gatewayPayment =
      await this.paymentGateway.fetchPayment(providerPaymentId);

    return this.applyGatewayPayment.execute(gatewayPayment);
  }
}
