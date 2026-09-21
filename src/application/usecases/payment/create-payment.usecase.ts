import { v4 as uuidv4 } from 'uuid';

import { PaymentMethodStrategy } from '@application/ports/payment-method-strategy.port';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentMethod, PaymentStatus } from '@domain/enums';
import { UnsupportedPaymentMethodException } from '@domain/exceptions';

interface CreatePaymentInput {
  cpf: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

export class CreatePaymentUseCase {
  private readonly strategies: ReadonlyMap<
    PaymentMethod,
    PaymentMethodStrategy
  >;

  constructor(strategies: PaymentMethodStrategy[]) {
    this.strategies = new Map(
      strategies.map((strategy) => [strategy.method, strategy]),
    );
  }

  async execute(input: CreatePaymentInput): Promise<Payment> {
    const payment = Payment.create(
      uuidv4(),
      input.cpf,
      input.description,
      input.amount,
      input.paymentMethod,
      PaymentStatus.PENDING,
    );

    const strategy = this.strategies.get(payment.paymentMethod);

    if (!strategy) {
      throw new UnsupportedPaymentMethodException(payment.paymentMethod);
    }

    return strategy.process(payment);
  }
}
