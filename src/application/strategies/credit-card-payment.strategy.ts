import { CreditCardPaymentOrchestratorPort } from '@application/ports/credit-card-payment-orchestrator.port';
import { PaymentMethodStrategy } from '@application/ports/payment-method-strategy.port';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentMethod } from '@domain/enums';

export class CreditCardPaymentStrategy implements PaymentMethodStrategy {
  readonly method = PaymentMethod.CREDIT_CARD;

  constructor(
    private readonly creditCardOrchestrator: CreditCardPaymentOrchestratorPort,
  ) {}

  async process(payment: Payment): Promise<Payment> {
    return this.creditCardOrchestrator.start(payment);
  }
}
