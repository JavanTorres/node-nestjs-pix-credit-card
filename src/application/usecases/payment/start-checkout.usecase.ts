import { LoggerPort } from '@application/ports/logger.port';
import { PaymentGatewayPort } from '@application/ports/payment-gateway.port';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';

export class StartCheckoutUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepositoryContract,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(payment: Payment): Promise<Payment> {
    if (payment.externalId && payment.checkoutUrl) {
      return payment;
    }

    const preference =
      await this.paymentGateway.createCheckoutPreference(payment);

    const linked = payment.withCheckout(
      preference.externalId,
      preference.initPoint,
    );
    const updated = await this.paymentRepository.update(linked);

    this.logger.log(
      `Preferência ${preference.externalId} criada para o pagamento ${payment.id}.`,
    );

    return updated ?? linked;
  }
}
