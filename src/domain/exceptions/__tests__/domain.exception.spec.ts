import {
  ConflictDomainException,
  DomainException,
  InvalidInputException,
  NotFoundDomainException,
} from '../domain.exception';

class SampleInvalid extends InvalidInputException {}
class SampleNotFound extends NotFoundDomainException {}
class SampleConflict extends ConflictDomainException {}

describe('DomainException', () => {
  it('deve ser um Error nativo, sem depender de framework', () => {
    expect(new SampleInvalid('x')).toBeInstanceOf(Error);
    expect(new SampleInvalid('x')).toBeInstanceOf(DomainException);
  });

  it('deve preservar a mensagem', () => {
    expect(new SampleInvalid('algo quebrou').message).toBe('algo quebrou');
  });

  it('deve nomear a exceção pela classe concreta', () => {
    expect(new SampleNotFound('x').name).toBe('SampleNotFound');
  });

  it('deve ter stack trace', () => {
    expect(new SampleConflict('x').stack).toBeDefined();
  });

  it.each([
    [new SampleInvalid('x'), InvalidInputException],
    [new SampleNotFound('x'), NotFoundDomainException],
    [new SampleConflict('x'), ConflictDomainException],
  ])('deve preservar a categoria da exceção', (exception, category) => {
    expect(exception).toBeInstanceOf(category);
  });
});
