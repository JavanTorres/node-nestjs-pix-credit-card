import { Payment } from '../../src/domain/entities/payment.entity';
import {
  Page,
  Pagination,
  PaymentFilters,
  PaymentRepositoryContract,
} from '../../src/domain/entities/repositories/payment.repository.contract';
import { ConcurrentPaymentUpdateException } from '../../src/domain/exceptions';

export class InMemoryPaymentRepository implements PaymentRepositoryContract {
  private readonly rows = new Map<string, Payment>();

  async create(payment: Payment): Promise<Payment> {
    this.rows.set(payment.id, payment);
    return payment;
  }

  async findById(id: string): Promise<Payment | null> {
    return this.rows.get(id) ?? null;
  }

  async findAll(
    filters: PaymentFilters,
    { page, limit }: Pagination,
  ): Promise<Page<Payment>> {
    const matches = [...this.rows.values()]
      .filter(
        (payment) =>
          (!filters.cpf || payment.cpf === filters.cpf) &&
          (!filters.paymentMethod ||
            payment.paymentMethod === filters.paymentMethod) &&
          (!filters.status || payment.status === filters.status),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (page - 1) * limit;

    return {
      items: matches.slice(start, start + limit),
      total: matches.length,
    };
  }

  async update(payment: Payment): Promise<Payment | null> {
    const current = this.rows.get(payment.id);
    if (!current) return null;

    if (current.version !== payment.version) {
      throw new ConcurrentPaymentUpdateException(payment.id);
    }

    const saved = new Payment(
      payment.id,
      payment.cpf,
      payment.description,
      payment.amount,
      payment.paymentMethod,
      payment.status,
      payment.createdAt,
      payment.updatedAt,
      payment.externalId,
      payment.checkoutUrl,
      payment.version + 1,
    );

    this.rows.set(saved.id, saved);
    return saved;
  }

  clear(): void {
    this.rows.clear();
  }
}
