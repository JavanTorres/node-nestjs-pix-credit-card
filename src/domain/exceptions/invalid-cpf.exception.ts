import { InvalidInputException } from './domain.exception';

export class InvalidCpfException extends InvalidInputException {
  constructor(public readonly cpf: string) {
    super(`CPF inválido: ${cpf}.`);
  }
}
