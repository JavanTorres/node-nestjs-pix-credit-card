import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentStatus } from '@domain/enums';
import {
  ManualStatusChangeNotAllowedException,
  PaymentNotFoundException,
} from '@domain/exceptions';

interface UpdatePaymentInput {
  description?: string;
  status?: PaymentStatus;
}

export class UpdatePaymentUseCase {
  constructor(private readonly paymentRepository: PaymentRepositoryContract) {}

  async execute(id: string, input: UpdatePaymentInput): Promise<Payment> {
    const payment = await this.paymentRepository.findById(id);

    if (!payment) {
      throw new PaymentNotFoundException(id);
    }

    const changesStatus =
      input.status !== undefined && input.status !== payment.status;

    if (changesStatus && !payment.allowsManualStatusChange()) {
      throw new ManualStatusChangeNotAllowedException(
        payment.id,
        payment.paymentMethod,
      );
    }

    let next = input.status ? payment.transitionTo(input.status) : payment;

    if (input.description !== undefined) {
      next = next.withDescription(input.description);
    }

    const updated = await this.paymentRepository.update(next);

    if (!updated) {
      throw new PaymentNotFoundException(id);
    }

    return updated;
  }
}
