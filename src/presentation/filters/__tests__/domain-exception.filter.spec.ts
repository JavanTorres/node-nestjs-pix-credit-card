import { ArgumentsHost, HttpStatus } from '@nestjs/common';

import {
  ConflictDomainException,
  InvalidInputException,
  NotFoundDomainException,
} from '@domain/exceptions';
import { DomainException } from '@domain/exceptions/domain.exception';

import { DomainExceptionFilter } from '../domain-exception.filter';

class SampleInvalid extends InvalidInputException {}
class SampleNotFound extends NotFoundDomainException {}
class SampleConflict extends ConflictDomainException {}
class SampleOther extends DomainException {}

describe('DomainExceptionFilter', () => {
  let filter: DomainExceptionFilter;
  let send: jest.Mock;
  let status: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new DomainExceptionFilter();
    send = jest.fn();
    status = jest.fn().mockReturnValue({ send });

    host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;
  });

  it.each([
    [new SampleNotFound('sumiu'), HttpStatus.NOT_FOUND],
    [new SampleConflict('conflito'), HttpStatus.CONFLICT],
    [new SampleInvalid('inválido'), HttpStatus.BAD_REQUEST],
    [new SampleOther('outro'), HttpStatus.UNPROCESSABLE_ENTITY],
  ])('deve mapear %s para o status correto', (exception, expected) => {
    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(expected);
  });

  it('deve responder com statusCode, nome e mensagem', () => {
    filter.catch(new SampleNotFound('Pagamento 1 não encontrado.'), host);

    expect(send).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      error: 'SampleNotFound',
      message: 'Pagamento 1 não encontrado.',
    });
  });
});
