import { Payment } from '@domain/entities/payment.entity';
import {
  Page,
  Pagination,
  PaymentFilters,
  PaymentRepositoryContract,
} from '@domain/entities/repositories/payment.repository.contract';

export const DEFAULT_PAGINATION: Readonly<Pagination> = { page: 1, limit: 20 };

export class FindAllPaymentsUseCase {
  constructor(private readonly paymentRepository: PaymentRepositoryContract) {}

  async execute(
    filters: PaymentFilters = {},
    pagination: Pagination = DEFAULT_PAGINATION,
  ): Promise<Page<Payment>> {
    return this.paymentRepository.findAll(filters, pagination);
  }
}
