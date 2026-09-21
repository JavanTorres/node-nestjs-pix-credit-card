import { Payment } from '@domain/entities/payment.entity';
import { PaymentMethod } from '@domain/enums';

export const PAYMENT_METHOD_STRATEGIES = Symbol('PAYMENT_METHOD_STRATEGIES');

export abstract class PaymentMethodStrategy {
  abstract readonly method: PaymentMethod;

  abstract process(payment: Payment): Promise<Payment>;
}
