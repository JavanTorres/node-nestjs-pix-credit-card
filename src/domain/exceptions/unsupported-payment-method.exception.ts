import { InvalidInputException } from './domain.exception';

export class UnsupportedPaymentMethodException extends InvalidInputException {
  constructor(public readonly paymentMethod: string) {
    super(`Meio de pagamento não suportado: ${paymentMethod}.`);
  }
}
