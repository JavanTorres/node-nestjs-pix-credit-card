import { CPF_LENGTH } from '@domain/constants';

export function stripCpfMask(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export function isValidCpf(cpf: string): boolean {
  if (typeof cpf !== 'string') return false;

  const digits = stripCpfMask(cpf);

  if (digits.length !== CPF_LENGTH) return false;

  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    calcCheckDigit(9) === Number(digits[9]) &&
    calcCheckDigit(10) === Number(digits[10])
  );
}
