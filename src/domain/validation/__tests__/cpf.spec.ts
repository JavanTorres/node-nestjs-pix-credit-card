import { isValidCpf, stripCpfMask } from '../cpf';

describe('stripCpfMask', () => {
  it('deve remover pontos e traço', () => {
    expect(stripCpfMask('529.982.247-25')).toBe('52998224725');
  });

  it('deve remover espaços', () => {
    expect(stripCpfMask(' 529 982 247 25 ')).toBe('52998224725');
  });

  it('deve manter um CPF já sem máscara', () => {
    expect(stripCpfMask('52998224725')).toBe('52998224725');
  });
});

describe('isValidCpf', () => {
  it.each(['52998224725', '11144477735', '01234567890'])(
    'deve aceitar o CPF válido %s',
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(true);
    },
  );

  it('deve aceitar CPF válido com máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
  });

  it.each([['00000000000'], ['11111111111'], ['99999999999']])(
    'deve recusar %s, com todos os dígitos iguais',
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(false);
    },
  );

  it('deve recusar quando o primeiro dígito verificador está errado', () => {
    expect(isValidCpf('52998224715')).toBe(false);
  });

  it('deve recusar quando o segundo dígito verificador está errado', () => {
    expect(isValidCpf('52998224726')).toBe(false);
  });

  it.each([
    ['5299822472', 'curto demais'],
    ['529982247251', 'longo demais'],
    ['', 'vazio'],
  ])('deve recusar "%s" (%s)', (cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });

  it('deve recusar texto sem dígitos', () => {
    expect(isValidCpf('abcdefghijk')).toBe(false);
  });

  it.each([[null], [undefined], [123], [{}]])(
    'deve recusar o valor não-string %p',
    (value) => {
      expect(isValidCpf(value as never)).toBe(false);
    },
  );
});
