import { InvalidInputException } from '../domain.exception';
import { InvalidCpfException } from '../invalid-cpf.exception';

describe('InvalidCpfException', () => {
  it('deve ser uma exceção de entrada inválida', () => {
    expect(new InvalidCpfException('111')).toBeInstanceOf(
      InvalidInputException,
    );
  });

  it('deve citar o CPF recusado', () => {
    expect(new InvalidCpfException('11111111111').message).toBe(
      'CPF inválido: 11111111111.',
    );
  });

  it('deve expor o CPF recusado', () => {
    expect(new InvalidCpfException('11111111111').cpf).toBe('11111111111');
  });
});
