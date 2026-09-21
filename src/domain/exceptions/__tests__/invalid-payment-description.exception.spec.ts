import { MAX_DESCRIPTION_LENGTH } from '@domain/constants';

import { InvalidInputException } from '../domain.exception';
import { InvalidPaymentDescriptionException } from '../invalid-payment-description.exception';

describe('InvalidPaymentDescriptionException', () => {
  it('deve ser uma exceção de entrada inválida', () => {
    expect(new InvalidPaymentDescriptionException(0)).toBeInstanceOf(
      InvalidInputException,
    );
  });

  it('deve citar o tamanho recebido e o limite', () => {
    const { message } = new InvalidPaymentDescriptionException(300);

    expect(message).toContain('300');
    expect(message).toContain(String(MAX_DESCRIPTION_LENGTH));
  });

  it('deve expor o tamanho recusado', () => {
    expect(new InvalidPaymentDescriptionException(300).length).toBe(300);
  });
});
