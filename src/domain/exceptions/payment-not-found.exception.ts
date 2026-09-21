import { NotFoundDomainException } from './domain.exception';

export class PaymentNotFoundException extends NotFoundDomainException {
  constructor(public readonly paymentId: string) {
    super(`Pagamento ${paymentId} não encontrado.`);
  }
}
