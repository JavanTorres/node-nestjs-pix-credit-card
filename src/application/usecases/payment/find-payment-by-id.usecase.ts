import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentNotFoundException } from '@domain/exceptions';

export class FindPaymentByIdUseCase {
  constructor(private readonly paymentRepository: PaymentRepositoryContract) {}

  async execute(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findById(id);

    if (!payment) {
      throw new PaymentNotFoundException(id);
    }

    return payment;
  }
}
