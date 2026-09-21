import { ENVIRONMENTS, normalizeEnvironment } from '../environment';

describe('normalizeEnvironment', () => {
  it.each([
    ['dev', 'development'],
    ['develop', 'development'],
    ['local', 'development'],
    ['testing', 'test'],
    ['prod', 'production'],
  ])('deve traduzir o apelido "%s" para "%s"', (input, expected) => {
    expect(normalizeEnvironment(input)).toBe(expected);
  });

  it.each(ENVIRONMENTS)('deve manter "%s" inalterado', (canonical) => {
    expect(normalizeEnvironment(canonical)).toBe(canonical);
  });

  it('deve ignorar caixa e espaços em volta', () => {
    expect(normalizeEnvironment('  PROD  ')).toBe('production');
  });

  it('deve assumir development quando indefinido', () => {
    expect(normalizeEnvironment(undefined)).toBe('development');
  });

  it('deve devolver o valor desconhecido sem traduzir', () => {
    expect(normalizeEnvironment('producton')).toBe('producton');
  });
});
