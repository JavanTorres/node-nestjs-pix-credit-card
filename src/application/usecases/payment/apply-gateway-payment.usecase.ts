import { LoggerPort } from '@application/ports/logger.port';
import { GatewayPayment } from '@application/ports/payment-gateway.port';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';

export class ApplyGatewayPaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepositoryContract,
    private readonly logger: LoggerPort,
  ) {}

  async execute(gatewayPayment: GatewayPayment): Promise<Payment | null> {
    const { providerPaymentId } = gatewayPayment;

    const payment = await this.paymentRepository.findById(
      gatewayPayment.externalReference,
    );

    if (!payment) {
      this.logger.warn(
        `Notificação ${providerPaymentId} referencia o pagamento ` +
          `${gatewayPayment.externalReference}, que não existe. Ignorando.`,
      );
      return null;
    }

    if (gatewayPayment.status === null) {
      return payment;
    }

    if (payment.status === gatewayPayment.status) {
      return payment;
    }

    if (!payment.canTransitionTo(gatewayPayment.status)) {
      this.logger.warn(
        `Pagamento ${payment.id} está em ${payment.status} e não pode ir ` +
          `para ${gatewayPayment.status}. Notificação ignorada.`,
      );
      return payment;
    }

    const updated = await this.paymentRepository.update(
      payment.transitionTo(gatewayPayment.status),
    );

    this.logger.log(
      `Pagamento ${payment.id} atualizado para ${gatewayPayment.status} ` +
        `pela notificação ${providerPaymentId}.`,
    );

    return updated;
  }
}
