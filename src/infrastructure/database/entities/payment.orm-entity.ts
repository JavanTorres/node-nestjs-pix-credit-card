import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { PaymentMethod, PaymentStatus } from '@domain/enums';

@Entity('payments')
export class PaymentOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index('IDX_payments_cpf')
  @Column({ type: 'char', length: 11 })
  cpf: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Index('IDX_payments_payment_method')
  @Column({ type: 'enum', enum: PaymentMethod, name: 'payment_method' })
  paymentMethod: PaymentMethod;

  @Index('IDX_payments_status')
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Index('UQ_payments_external_id', {
    unique: true,
    where: '"external_id" IS NOT NULL',
  })
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'external_id' })
  externalId: string | null;

  @Column({
    type: 'varchar',
    length: 512,
    nullable: true,
    name: 'checkout_url',
  })
  checkoutUrl: string | null;

  @Column({ type: 'integer', default: 0 })
  version: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
