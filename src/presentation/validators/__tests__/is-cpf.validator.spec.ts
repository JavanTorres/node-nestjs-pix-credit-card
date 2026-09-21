import { validate } from 'class-validator';

import { IsCpf } from '../is-cpf.validator';

class Target {
  @IsCpf()
  cpf: string;

  constructor(cpf: unknown) {
    this.cpf = cpf as string;
  }
}

describe('IsCpf', () => {
  it('deve aceitar um CPF válido sem máscara', async () => {
    await expect(validate(new Target('52998224725'))).resolves.toHaveLength(0);
  });

  it('deve aceitar um CPF válido com máscara', async () => {
    await expect(validate(new Target('529.982.247-25'))).resolves.toHaveLength(
      0,
    );
  });

  it('deve recusar um CPF inválido', async () => {
    await expect(validate(new Target('11111111111'))).resolves.toHaveLength(1);
  });

  it('deve recusar valor que não é string', async () => {
    await expect(validate(new Target(52998224725))).resolves.toHaveLength(1);
  });

  it('deve expor uma mensagem citando a propriedade', async () => {
    const [error] = await validate(new Target('123'));

    expect(error.constraints?.isCpf).toBe('cpf deve ser um CPF válido');
  });
});
