import { MAX_PAYMENT_AMOUNT, MIN_PAYMENT_AMOUNT } from '@domain/constants';

import { InvalidInputException } from '../domain.exception';
import { InvalidPaymentAmountException } from '../invalid-payment-amount.exception';

describe('InvalidPaymentAmountException', () => {
  it('deve ser uma exceção de entrada inválida', () => {
    expect(new InvalidPaymentAmountException(0)).toBeInstanceOf(
      InvalidInputException,
    );
  });

  it('deve citar o valor recusado e a faixa aceita', () => {
    const { message } = new InvalidPaymentAmountException(0);

    expect(message).toContain('0');
    expect(message).toContain(String(MIN_PAYMENT_AMOUNT));
    expect(message).toContain(String(MAX_PAYMENT_AMOUNT));
  });

  it('deve expor o valor recusado', () => {
    expect(new InvalidPaymentAmountException(1234).amount).toBe(1234);
  });
});
