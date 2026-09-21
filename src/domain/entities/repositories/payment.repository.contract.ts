import { PaymentMethod, PaymentStatus } from '@domain/enums';

import { Payment } from '../payment.entity';

export interface PaymentFilters {
  cpf?: string;
  paymentMethod?: PaymentMethod;
  status?: PaymentStatus;
}

export interface Pagination {
  page: number;
  limit: number;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export abstract class PaymentRepositoryContract {
  abstract create(payment: Payment): Promise<Payment>;
  abstract findById(id: string): Promise<Payment | null>;
  abstract findAll(
    filters: PaymentFilters,
    pagination: Pagination,
  ): Promise<Page<Payment>>;
  abstract update(payment: Payment): Promise<Payment | null>;
}
