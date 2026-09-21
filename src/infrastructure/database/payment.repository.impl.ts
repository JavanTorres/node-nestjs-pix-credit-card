import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Payment } from '@domain/entities/payment.entity';
import {
  Page,
  Pagination,
  PaymentFilters,
  PaymentRepositoryContract,
} from '@domain/entities/repositories/payment.repository.contract';
import { ConcurrentPaymentUpdateException } from '@domain/exceptions';
import { stripCpfMask } from '@domain/validation/cpf';

import { PaymentOrmEntity } from './entities/payment.orm-entity';

@Injectable()
export class PaymentRepositoryImpl implements PaymentRepositoryContract {
  constructor(
    @InjectRepository(PaymentOrmEntity)
    private readonly repository: Repository<PaymentOrmEntity>,
  ) {}

  private static toDomain(row: PaymentOrmEntity): Payment {
    return new Payment(
      row.id,
      row.cpf,
      row.description,
      Number(row.amount),
      row.paymentMethod,
      row.status,
      row.createdAt,
      row.updatedAt,
      row.externalId,
      row.checkoutUrl,
      row.version,
    );
  }

  private static toPersistence(payment: Payment): PaymentOrmEntity {
    const row = new PaymentOrmEntity();
    row.id = payment.id;
    row.cpf = payment.cpf;
    row.description = payment.description;
    row.amount = payment.amount.toFixed(2);
    row.paymentMethod = payment.paymentMethod;
    row.status = payment.status;
    row.externalId = payment.externalId;
    row.checkoutUrl = payment.checkoutUrl;
    row.version = payment.version;
    row.createdAt = payment.createdAt;
    row.updatedAt = payment.updatedAt;
    return row;
  }

  async create(payment: Payment): Promise<Payment> {
    const saved = await this.repository.save(
      PaymentRepositoryImpl.toPersistence(payment),
    );
    return PaymentRepositoryImpl.toDomain(saved);
  }

  async findById(id: string): Promise<Payment | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? PaymentRepositoryImpl.toDomain(row) : null;
  }

  async findAll(
    filters: PaymentFilters,
    { page, limit }: Pagination,
  ): Promise<Page<Payment>> {
    const where: Record<string, unknown> = {};

    if (filters.cpf) where.cpf = stripCpfMask(filters.cpf);
    if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;
    if (filters.status) where.status = filters.status;

    const [rows, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items: rows.map(PaymentRepositoryImpl.toDomain), total };
  }

  async update(payment: Payment): Promise<Payment | null> {
    const row = PaymentRepositoryImpl.toPersistence(payment);
    row.version = payment.version + 1;

    const result = await this.repository.update(
      { id: payment.id, version: payment.version },
      row,
    );

    if (!result.affected) {
      const exists = await this.repository.existsBy({ id: payment.id });
      if (!exists) return null;

      throw new ConcurrentPaymentUpdateException(payment.id);
    }

    return PaymentRepositoryImpl.toDomain(row);
  }
}
