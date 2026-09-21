import {
  MAX_DESCRIPTION_LENGTH,
  MAX_PAYMENT_AMOUNT,
  MIN_PAYMENT_AMOUNT,
} from '@domain/constants';
import { PaymentMethod, PaymentStatus } from '@domain/enums';
import {
  InvalidCpfException,
  InvalidPaymentAmountException,
  InvalidPaymentDescriptionException,
  InvalidPaymentStatusTransitionException,
} from '@domain/exceptions';
import { isValidCpf, stripCpfMask } from '@domain/validation/cpf';

const ALLOWED_TRANSITIONS: Readonly<Record<PaymentStatus, PaymentStatus[]>> = {
  [PaymentStatus.PENDING]: [PaymentStatus.PAID, PaymentStatus.FAIL],
  [PaymentStatus.PAID]: [],
  [PaymentStatus.FAIL]: [],
};

export class Payment {
  constructor(
    public readonly id: string,
    public readonly cpf: string,
    public readonly description: string,
    public readonly amount: number,
    public readonly paymentMethod: PaymentMethod,
    public readonly status: PaymentStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly externalId: string | null = null,
    public readonly checkoutUrl: string | null = null,
    public readonly version: number = 0,
  ) {
    this.validateCpf();
    this.validateDescription();
    this.validateAmount();
  }

  public static create(
    id: string,
    cpf: string,
    description: string,
    amount: number,
    paymentMethod: PaymentMethod,
    status: PaymentStatus = PaymentStatus.PENDING,
    createdAt?: Date,
    updatedAt?: Date,
    externalId: string | null = null,
    checkoutUrl: string | null = null,
  ): Payment {
    const now = new Date();
    return new Payment(
      id,
      stripCpfMask(cpf),
      description,
      amount,
      paymentMethod,
      status,
      createdAt ?? now,
      updatedAt ?? now,
      externalId,
      checkoutUrl,
    );
  }

  private validateCpf(): void {
    if (!isValidCpf(this.cpf)) {
      throw new InvalidCpfException(this.cpf);
    }
  }

  private validateDescription(): void {
    const length = this.description?.trim().length ?? 0;

    if (length === 0 || length > MAX_DESCRIPTION_LENGTH) {
      throw new InvalidPaymentDescriptionException(length);
    }
  }

  private validateAmount(): void {
    if (
      !Number.isFinite(this.amount) ||
      this.amount < MIN_PAYMENT_AMOUNT ||
      this.amount > MAX_PAYMENT_AMOUNT
    ) {
      throw new InvalidPaymentAmountException(this.amount);
    }
  }

  public isPix(): boolean {
    return this.paymentMethod === PaymentMethod.PIX;
  }

  public allowsManualStatusChange(): boolean {
    return this.isPix();
  }

  public canTransitionTo(status: PaymentStatus): boolean {
    return ALLOWED_TRANSITIONS[this.status].includes(status);
  }

  public transitionTo(status: PaymentStatus): Payment {
    if (status === this.status) return this;

    if (!this.canTransitionTo(status)) {
      throw new InvalidPaymentStatusTransitionException(this.status, status);
    }

    return this.copy({ status });
  }

  public withDescription(description: string): Payment {
    if (description === this.description) return this;

    return this.copy({ description });
  }

  public withCheckout(externalId: string, checkoutUrl: string): Payment {
    return this.copy({ externalId, checkoutUrl });
  }

  private copy(
    changes: Partial<
      Pick<Payment, 'status' | 'description' | 'externalId' | 'checkoutUrl'>
    >,
  ): Payment {
    return new Payment(
      this.id,
      this.cpf,
      changes.description ?? this.description,
      this.amount,
      this.paymentMethod,
      changes.status ?? this.status,
      this.createdAt,
      new Date(),
      changes.externalId ?? this.externalId,
      changes.checkoutUrl ?? this.checkoutUrl,
      this.version,
    );
  }
}
