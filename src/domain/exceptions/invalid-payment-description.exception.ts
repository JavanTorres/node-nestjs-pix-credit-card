import { MAX_DESCRIPTION_LENGTH } from '@domain/constants';

import { InvalidInputException } from './domain.exception';

export class InvalidPaymentDescriptionException extends InvalidInputException {
  constructor(public readonly length: number) {
    super(
      `Descrição inválida: ${length} caracteres. ` +
        `Deve ter entre 1 e ${MAX_DESCRIPTION_LENGTH}.`,
    );
  }
}
