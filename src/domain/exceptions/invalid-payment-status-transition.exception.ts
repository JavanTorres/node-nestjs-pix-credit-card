import { PaymentStatus } from '@domain/enums';

import { ConflictDomainException } from './domain.exception';

export class InvalidPaymentStatusTransitionException extends ConflictDomainException {
  constructor(
    public readonly from: PaymentStatus,
    public readonly to: PaymentStatus,
  ) {
    super(`Transição de status inválida: ${from} -> ${to}.`);
  }
}
