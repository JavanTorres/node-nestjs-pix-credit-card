import { ConflictDomainException } from './domain.exception';

export class ConcurrentPaymentUpdateException extends ConflictDomainException {
  constructor(public readonly paymentId: string) {
    super(
      `O pagamento ${paymentId} foi alterado por outra operação. ` +
        'Consulte o estado atual e tente novamente.',
    );
  }
}
