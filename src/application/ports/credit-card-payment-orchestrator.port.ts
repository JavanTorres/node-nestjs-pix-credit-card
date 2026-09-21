import { Payment } from '@domain/entities/payment.entity';

export abstract class CreditCardPaymentOrchestratorPort {
  abstract start(payment: Payment): Promise<Payment>;

  abstract notify(providerPaymentId: string): Promise<void>;
}
