import { MAX_PAYMENT_AMOUNT, MIN_PAYMENT_AMOUNT } from '@domain/constants';

import { InvalidInputException } from './domain.exception';

export class InvalidPaymentAmountException extends InvalidInputException {
  constructor(public readonly amount: number) {
    super(
      `Valor inválido: ${amount}. Deve estar entre ${MIN_PAYMENT_AMOUNT} e ${MAX_PAYMENT_AMOUNT}.`,
    );
  }
}
