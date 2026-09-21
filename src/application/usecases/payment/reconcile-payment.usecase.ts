import { PaymentGatewayPort } from '@application/ports/payment-gateway.port';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentStatus } from '@domain/enums';
import { PaymentNotFoundException } from '@domain/exceptions';

import { ApplyGatewayPaymentUseCase } from './apply-gateway-payment.usecase';

export class ReconcilePaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepositoryContract,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly applyGatewayPayment: ApplyGatewayPaymentUseCase,
  ) {}

  async execute(paymentId: string): Promise<PaymentStatus | null> {
    const payment = await this.paymentRepository.findById(paymentId);

    if (!payment) {
      throw new PaymentNotFoundException(paymentId);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return payment.status;
    }

    const gatewayPayment =
      await this.paymentGateway.findPaymentByExternalReference(paymentId);

    if (!gatewayPayment) {
      return null;
    }

    const updated = await this.applyGatewayPayment.execute(gatewayPayment);

    return updated && updated.status !== PaymentStatus.PENDING
      ? updated.status
      : null;
  }
}
