import { PaymentMethodStrategy } from '@application/ports/payment-method-strategy.port';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentMethod } from '@domain/enums';

export class PixPaymentStrategy implements PaymentMethodStrategy {
  readonly method = PaymentMethod.PIX;

  constructor(private readonly paymentRepository: PaymentRepositoryContract) {}

  async process(payment: Payment): Promise<Payment> {
    return this.paymentRepository.create(payment);
  }
}
